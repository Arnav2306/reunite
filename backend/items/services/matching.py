import re
import uuid
from datetime import datetime
from django.utils import timezone
from django.db import transaction
from django.contrib.contenttypes.models import ContentType

from items.models import FoundItem, LostItem, Match, MatchStatus, ItemStatus
from notifications.models import Notification

ALGORITHM_VERSION = 'v1'

# Initial weights based on SRS design
WEIGHTS = {
    'attribute': 40,
    'category': 20,
    'location': 15,
    'time': 10,
    'feature': 10,
    'photo': 0,  # Photo similarity is currently not available; normalized out
}

TOTAL_AVAILABLE_WEIGHT = sum(WEIGHTS.values())  # 95


def get_match_label(score: int) -> str:
    """
    Returns the standardized human-readable match strength label.
    85+: Strong Possible Match
    65-84: Possible Match
    Below 65: Weak Match
    """
    if score >= 85:
        return "Strong Possible Match"
    elif score >= 65:
        return "Possible Match"
    else:
        return "Weak Match"


def _tokenize(text: str) -> set:
    if not text:
        return set()
    cleaned = re.sub(r'[^a-zA-Z0-9\s]', ' ', text.lower())
    stop_words = {'a', 'an', 'the', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'is', 'it', 'and', 'or', 'my', 'some'}
    return {w for w in cleaned.split() if len(w) > 1 and w not in stop_words}


def calculate_match_score(lost_item: LostItem, found_item: FoundItem) -> tuple[int, dict]:
    """
    Calculates deterministic match score (0-100) and breakdown between a LostItem and a FoundItem.
    Does not use fake data or fake AI components.
    Unimplemented signals (such as photo embeddings) are explicitly set to None and normalized out.
    """
    # 1. Category Score (0.0 to 1.0)
    lost_cat = (lost_item.category or '').strip().lower()
    found_cat = (found_item.category or '').strip().lower()

    if lost_cat and found_cat:
        if lost_cat == found_cat:
            cat_raw = 1.0
        elif lost_cat in found_cat or found_cat in lost_cat:
            cat_raw = 0.75
        elif 'other' in lost_cat or 'other' in found_cat:
            cat_raw = 0.4
        else:
            cat_raw = 0.0
    else:
        cat_raw = 0.3

    # 2. Semantic / Attribute Similarity (0.0 to 1.0)
    # Compare normalized_attributes and description
    lost_attrs = lost_item.normalized_attributes or {}
    found_text = f"{found_item.title or ''} {found_item.description or ''}".lower()
    found_tokens = _tokenize(found_text)

    attr_matches = 0
    attr_total = 0

    for key, val in lost_attrs.items():
        if val and isinstance(val, str) and val.strip():
            attr_total += 1
            val_lower = val.strip().lower()
            val_tokens = _tokenize(val_lower)
            if val_lower in found_text or (val_tokens and val_tokens.issubset(found_tokens)):
                attr_matches += 1
            elif val_tokens and any(t in found_tokens for t in val_tokens):
                attr_matches += 0.5

    # Description text token overlap
    lost_desc_tokens = _tokenize(lost_item.description or '')
    if lost_desc_tokens and found_tokens:
        overlap = len(lost_desc_tokens.intersection(found_tokens))
        union = len(lost_desc_tokens.union(found_tokens))
        jaccard = overlap / union if union > 0 else 0.0
    else:
        jaccard = 0.0

    if attr_total > 0:
        attr_ratio = attr_matches / attr_total
        # Blend explicit attribute matches (70%) with text description similarity (30%)
        attr_raw = min(1.0, (attr_ratio * 0.7) + (min(1.0, jaccard * 2.5) * 0.3))
    else:
        # Fallback entirely to text description similarity
        attr_raw = min(1.0, jaccard * 3.0) if jaccard > 0 else 0.2

    # 3. Location Signal (0.0 to 1.0)
    orig_answers = lost_item.original_answers or {}
    lost_loc = str(orig_answers.get('lost_location') or '').strip().lower()
    found_loc = str(found_item.found_location or '').strip().lower()

    if lost_loc and found_loc:
        lost_loc_tokens = _tokenize(lost_loc)
        found_loc_tokens = _tokenize(found_loc)
        if lost_loc == found_loc:
            loc_raw = 1.0
        elif lost_loc in found_loc or found_loc in lost_loc:
            loc_raw = 0.85
        elif lost_loc_tokens and found_loc_tokens and lost_loc_tokens.intersection(found_loc_tokens):
            loc_raw = 0.7
        else:
            loc_raw = 0.25  # Different location on campus
    else:
        loc_raw = 0.4  # Unknown location

    # 4. Time Signal (0.0 to 1.0)
    lost_date_str = str(orig_answers.get('lost_date') or '').strip()
    found_date = found_item.found_date

    lost_date = None
    if lost_date_str:
        for fmt in ('%Y-%m-%d', '%d/%m/%Y', '%m/%d/%Y'):
            try:
                lost_date = datetime.strptime(lost_date_str, fmt).date()
                break
            except ValueError:
                pass

    if lost_date and found_date:
        diff_days = (found_date - lost_date).days
        if 0 <= diff_days <= 1:
            time_raw = 1.0
        elif 2 <= diff_days <= 5:
            time_raw = 0.85
        elif 6 <= diff_days <= 14:
            time_raw = 0.65
        elif 15 <= diff_days <= 30:
            time_raw = 0.4
        elif diff_days > 30:
            time_raw = 0.2
        elif -2 <= diff_days < 0:
            # Student may have misestimated when item was lost by 1-2 days
            time_raw = 0.7
        else:
            # Found substantially before reported lost
            time_raw = 0.1
    else:
        time_raw = 0.5  # Neutral if date not available

    # 5. Distinguishing Features Signal (0.0 to 1.0)
    distinguishing_text = ''
    for feat_key in ('distinguishing_feature', 'distinctive_mark', 'mark', 'extra', 'label', 'content'):
        if feat_key in lost_attrs and lost_attrs[feat_key]:
            distinguishing_text += f" {lost_attrs[feat_key]}"
        elif feat_key in orig_answers and orig_answers[feat_key]:
            distinguishing_text += f" {orig_answers[feat_key]}"

    dist_tokens = _tokenize(distinguishing_text)
    if dist_tokens:
        overlap = dist_tokens.intersection(found_tokens)
        if len(overlap) >= 2 or (len(dist_tokens) == 1 and len(overlap) == 1):
            feat_raw = 1.0
        elif len(overlap) == 1:
            feat_raw = 0.7
        else:
            feat_raw = 0.3
    else:
        # No distinguishing marks specified: neutral
        feat_raw = 0.5

    # 6. Photo Similarity (Unimplemented)
    photo_raw = None

    # Calculate weighted score normalized to 100
    weighted_sum = (
        (cat_raw * WEIGHTS['category']) +
        (attr_raw * WEIGHTS['attribute']) +
        (loc_raw * WEIGHTS['location']) +
        (time_raw * WEIGHTS['time']) +
        (feat_raw * WEIGHTS['feature'])
    )

    # Normalize by total available weight (95 -> 100 scale)
    final_score = int(round((weighted_sum / TOTAL_AVAILABLE_WEIGHT) * 100))
    final_score = max(0, min(100, final_score))

    breakdown = {
        'category_score': round(cat_raw * 100, 1),
        'attribute_score': round(attr_raw * 100, 1),
        'location_score': round(loc_raw * 100, 1),
        'time_score': round(time_raw * 100, 1),
        'feature_score': round(feat_raw * 100, 1),
        'photo_score': None,  # Not calculated; not fabricated
        'weights_used': WEIGHTS,
        'final_score': final_score,
        'algorithm_version': ALGORITHM_VERSION,
    }

    return final_score, breakdown


def evaluate_lost_item_matches(lost_item: LostItem, notify: bool = True) -> list[Match]:
    """
    Evaluates a LostItem against all published FoundItems.
    Creates or updates Match records and triggers notification for high-confidence matches.
    """
    matches_created_or_updated = []
    found_items = FoundItem.objects.filter(is_published=True)

    high_matches = []

    for found_item in found_items:
        score, breakdown = calculate_match_score(lost_item, found_item)
        
        # Only record match candidates if they have non-trivial score (e.g. >= 40)
        # or if category matches
        if score >= 40 or breakdown['category_score'] >= 75:
            existing = Match.objects.filter(lost_item=lost_item, found_item=found_item).first()
            pub_id = existing.public_id if (existing and existing.public_id) else str(uuid.uuid4())
            match_obj, created = Match.objects.update_or_create(
                lost_item=lost_item,
                found_item=found_item,
                defaults={
                    'public_id': pub_id,
                    'score': score,
                    'score_breakdown': breakdown,
                    'matching_algorithm_version': ALGORITHM_VERSION,
                }
            )
            matches_created_or_updated.append(match_obj)
            if score >= 65:
                high_matches.append((match_obj, score))

    if high_matches:
        if lost_item.status == ItemStatus.REPORTED:
            lost_item.status = ItemStatus.MATCH_FOUND
            lost_item.save(update_fields=['status', 'updated_at'])

        if notify:
            best_match, best_score = max(high_matches, key=lambda x: x[1])
            label = get_match_label(best_score)
            Notification.objects.create(
                public_id=str(uuid.uuid4()),
                user=lost_item.user,
                title="Potential Match Found",
                message=f"We found a potential match ({best_score}/100 — {label}) for your lost {lost_item.category} report.",
                notification_type='MATCH_FOUND',
            )

    return matches_created_or_updated


def evaluate_found_item_matches(found_item: FoundItem, notify: bool = True) -> list[Match]:
    """
    Evaluates a newly published FoundItem against all active LostItems.
    Creates or updates Match records and notifies relevant students if score >= 65.
    """
    if not found_item.is_published:
        return []

    active_lost_items = LostItem.objects.filter(
        status__in=[ItemStatus.REPORTED, ItemStatus.MATCH_FOUND]
    )

    matches_created_or_updated = []

    for lost_item in active_lost_items:
        score, breakdown = calculate_match_score(lost_item, found_item)
        if score >= 40 or breakdown['category_score'] >= 75:
            existing = Match.objects.filter(lost_item=lost_item, found_item=found_item).first()
            pub_id = existing.public_id if (existing and existing.public_id) else str(uuid.uuid4())
            match_obj, created = Match.objects.update_or_create(
                lost_item=lost_item,
                found_item=found_item,
                defaults={
                    'public_id': pub_id,
                    'score': score,
                    'score_breakdown': breakdown,
                    'matching_algorithm_version': ALGORITHM_VERSION,
                }
            )
            matches_created_or_updated.append(match_obj)

            if score >= 65:
                if lost_item.status == ItemStatus.REPORTED:
                    lost_item.status = ItemStatus.MATCH_FOUND
                    lost_item.save(update_fields=['status', 'updated_at'])

                if notify:
                    label = get_match_label(score)
                    Notification.objects.create(
                        public_id=str(uuid.uuid4()),
                        user=lost_item.user,
                        title="Potential Match Found",
                        message=f"A newly published item matches your lost {lost_item.category} report ({score}/100 — {label}).",
                        notification_type='MATCH_FOUND',
                    )

    return matches_created_or_updated
