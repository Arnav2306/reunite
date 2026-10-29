import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery } from '@tanstack/react-query';
import { apiRequest, ApiError, api } from '../services/api';
import {
  ChevronDown, Upload, X, CheckCircle2, AlertCircle,
  Loader2, ArrowLeft, ArrowRight, Sparkles
} from 'lucide-react';

export interface CategoryQuestion {
  key: string;
  label: string;
  type: string;
  options: string[];
  allow_detail?: boolean;
  detail_placeholder?: string;
}

interface QuestionBankResponse {
  version: string;
  categories: string[];
  questions: Record<string, CategoryQuestion[]>;
}

export const CATEGORIES = [
  'Phone',
  'Laptop',
  'Backpack & Bags',
  'Wallet & Cards',
  'Keys & Badges',
  'Vehicle Keys',
  'Bottles & Containers',
  'Headphones & Earphones',
  'Chargers & Cables',
  'Helmets & Riding Gear',
  'Electronics',
  'Stationery & Books',
  'Clothing & Accessories',
  'Jewellery & Watches',
  'Sports & Fitness',
  'Documents & ID',
  'Other',
];


// Fallback synchronous question bank matching backend service exactly
const FALLBACK_QUESTION_BANK: Record<string, CategoryQuestion[]> = {
  'Phone': [
    {
      key: 'brand',
      label: 'Brand / Manufacturer',
      type: 'choice',
      options: ['Apple (iPhone)', 'Samsung Galaxy', 'OnePlus', 'Google Pixel', 'Xiaomi / Redmi / Poco', 'Realme', 'Vivo', 'Oppo', 'Motorola', 'Other', 'Not sure'],
      allow_detail: true,
      detail_placeholder: 'Specify brand if Other or specific model series'
    },
    {
      key: 'main_color',
      label: 'Body / Back Color',
      type: 'choice',
      options: ['Black / Space Grey', 'White / Silver', 'Blue / Navy', 'Green / Olive', 'Purple / Lavender', 'Gold / Rose Gold', 'Red', 'Yellow / Coral', 'Other', 'Not sure'],
      allow_detail: true,
      detail_placeholder: 'Describe finish or color shade'
    },
    {
      key: 'case_style',
      label: 'Case or Cover Style',
      type: 'choice',
      options: ['No case / Naked phone', 'Transparent / Clear case', 'Black / Dark silicone case', 'Solid color silicone / hard case', 'Patterned / Printed case', 'Wallet / Flip cover with card slots', 'Heavy-duty / Rugged bumper case', 'Other', 'Not sure'],
      allow_detail: true,
      detail_placeholder: 'Describe case color, design, or card inside'
    },
    {
      key: 'distinguishing_feature',
      label: 'Distinguishing Exterior Feature',
      type: 'choice',
      options: ['Screen protector / tempered glass installed', 'PopSocket or ring holder on back', 'Sticker or photo behind transparent case', 'Visible scratch or hairline crack on glass', 'Dented or scuffed corner / frame', 'Camera lens protector attached', 'None / Clean condition', 'Other', 'Not sure'],
      allow_detail: true,
      detail_placeholder: 'Describe sticker, crack location, or distinctive mark'
    }
  ],
  'Laptop': [
    {
      key: 'brand',
      label: 'Brand / Manufacturer',
      type: 'choice',
      options: ['Apple MacBook', 'Dell (Inspiron / XPS / Latitude)', 'Lenovo (ThinkPad / IdeaPad / Yoga)', 'HP (Pavilion / Envy / Victus)', 'ASUS (ZenBook / ROG / TUF / VivoBook)', 'Acer (Aspire / Predator / Swift)', 'MSI', 'Microsoft Surface', 'Other', 'Not sure'],
      allow_detail: true,
      detail_placeholder: 'Specify brand and series'
    },
    {
      key: 'model_family',
      label: 'Model Family / Screen Size',
      type: 'choice',
      options: ['13-inch Compact / Ultrabook', '14-inch Standard Thin & Light', '15-inch to 16-inch Standard / Gaming', '17-inch Large Laptop', '2-in-1 Touchscreen / Convertible', 'MacBook Air', 'MacBook Pro', 'Other', 'Not sure'],
      allow_detail: true,
      detail_placeholder: 'Approximate model or processor badge if known'
    },
    {
      key: 'main_color',
      label: 'Exterior Body Color',
      type: 'choice',
      options: ['Silver / Aluminum', 'Space Grey / Dark Grey', 'Matte Black', 'Midnight / Dark Blue', 'White / Platinum', 'Gold / Rose Gold', 'Other', 'Not sure'],
      allow_detail: true,
      detail_placeholder: 'Color or finish details'
    },
    {
      key: 'distinctive_mark',
      label: 'Sticker, Sleeve, or Distinctive Mark',
      type: 'choice',
      options: ['Multiple stickers on lid (tech, college, anime, etc.)', 'Single sticker or logo decal on lid', 'Hard shell snap-on case attached', 'Inside a zip laptop sleeve / bag', 'Keyboard cover skin installed', 'Noticeable dent, scratch, or scuff mark', 'None / Plain pristine lid', 'Other', 'Not sure'],
      allow_detail: true,
      detail_placeholder: 'Describe stickers, sleeve color, or mark location'
    }
  ],
  'Backpack & Bags': [
    {
      key: 'main_color',
      label: 'Main Color',
      type: 'choice',
      options: ['Black', 'Navy / Dark Blue', 'Grey / Charcoal', 'Red / Maroon', 'Green / Olive', 'Brown / Tan', 'Two-tone / Multi-colored', 'Other', 'Not sure'],
      allow_detail: true,
      detail_placeholder: 'Color shade or dual colors'
    },
    {
      key: 'brand',
      label: 'Brand (if visible)',
      type: 'choice',
      options: ['Wildcraft', 'American Tourister', 'Skybags', 'Nike / Adidas / Puma', 'JanSport', 'North Face', 'Lenovo / HP / Dell laptop bag', 'Decathlon / Quechua', 'Unbranded / Generic', 'Other', 'Not sure'],
      allow_detail: true,
      detail_placeholder: 'Brand name if known'
    },
    {
      key: 'bag_type',
      label: 'Bag Style & Material',
      type: 'choice',
      options: ['Standard College Backpack (polyester/nylon)', 'Laptop Backpack with padded compartment', 'Tote bag (canvas / cloth)', 'Duffel / Gym bag', 'Messenger / Crossbody sling bag', 'Leather / Faux-leather bag', 'Other', 'Not sure'],
      allow_detail: true,
      detail_placeholder: 'Style or compartment details'
    },
    {
      key: 'distinguishing_feature',
      label: 'Keychain, Tag, or Distinctive Mark',
      type: 'choice',
      options: ['Keychain or plushie charm attached to zipper', 'Water bottle visible in side mesh pocket', 'College pin, badge, or patch attached', 'Luggage name tag / ribbon attached to handle', 'Torn strap, broken zipper pull, or scuff mark', 'None / Plain bag', 'Other', 'Not sure'],
      allow_detail: true,
      detail_placeholder: 'Describe keychain, badge, or zipper pull'
    }
  ],
  'Wallet & Cards': [
    {
      key: 'main_color',
      label: 'Wallet Color',
      type: 'choice',
      options: ['Black', 'Dark Brown', 'Tan / Light Brown', 'Blue / Navy', 'Red / Burgundy', 'Grey', 'Other', 'Not sure'],
      allow_detail: true,
      detail_placeholder: 'Color shade or pattern'
    },
    {
      key: 'material',
      label: 'Material',
      type: 'choice',
      options: ['Genuine Leather', 'Faux / Synthetic Leather (PU)', 'Fabric / Canvas / Nylon', 'Metal / Carbon Fiber cardholder', 'Plastic / Silicone card sleeve', 'Other', 'Not sure'],
      allow_detail: true,
      detail_placeholder: 'Material description'
    },
    {
      key: 'wallet_style',
      label: 'Wallet Style / Shape',
      type: 'choice',
      options: ['Classic Bifold (folds in half)', 'Trifold (folds in three parts)', 'Slim Cardholder / Money clip', 'Long zip-around wallet / Clutch', 'Coin pouch / Small pouch', 'ID card lanyard with card sleeve', 'Other', 'Not sure'],
      allow_detail: true,
      detail_placeholder: 'Shape or brand if known'
    },
    {
      key: 'distinguishing_mark',
      label: 'General Contents or Distinguishing Mark',
      type: 'choice',
      options: ['Contains College ID card (no numbers needed)', 'Contains Metro / Transit card', 'Contains driving licence or bank card', 'Embossed logo or stitched brand emblem', 'Elastic band or metal clip on exterior', 'Noticeable wear or worn edges', 'Other', 'Not sure'],
      allow_detail: true,
      detail_placeholder: 'General identifying detail without confidential numbers'
    }
  ],
  'Keys & Badges': [
    {
      key: 'key_count_type',
      label: 'Key Type & Approximate Count',
      type: 'choice',
      options: ['Single key (room or padlock)', '2 to 3 keys on a ring', '4 or more keys on a ring', 'Bike / Motorcycle key', 'Car key / Remote key fob', 'Campus ID access card / RFID badge', 'Combination of keys and ID badge', 'Other', 'Not sure'],
      allow_detail: true,
      detail_placeholder: 'Vehicle brand, room number prefix, etc.'
    },
    {
      key: 'keychain_presence',
      label: 'Keychain Presence',
      type: 'choice',
      options: ['Yes, keychain / lanyard attached', 'No keychain, just plain metallic key ring', 'Single key with no ring or tag', 'Other', 'Not sure'],
      allow_detail: true,
      detail_placeholder: 'Tag or ring details'
    },
    {
      key: 'keychain_style_color',
      label: 'Keychain Color & Style',
      type: 'choice',
      options: ['College lanyard / neck strap', 'Fabric ribbon strap (red, black, blue, etc.)', 'Metal logo or vehicle brand keychain', 'Rubber / Silicon character or anime figurine', 'Leather strap or loop', 'Mini flashlight, bottle opener, or multi-tool', 'Plastic room tag / numbered token', 'No keychain / Plain ring', 'Other', 'Not sure'],
      allow_detail: true,
      detail_placeholder: 'Describe keychain color, character, or text'
    },
    {
      key: 'distinguishing_feature',
      label: 'Distinguishing Mark or Engraving',
      type: 'choice',
      options: ['Room number stamped or written on key/tag', 'Vehicle brand logo on key head (Honda, Yamaha, Suzuki, etc.)', 'Colored plastic key topper / cap', 'Mini carabiner / hook attached', 'Bent or discolored key', 'None / Plain metallic keys', 'Other', 'Not sure'],
      allow_detail: true,
      detail_placeholder: 'Room number or specific logo'
    }
  ],
  'Bottles & Containers': [
    {
      key: 'main_color',
      label: 'Main Bottle Color',
      type: 'choice',
      options: ['Silver / Stainless Steel metallic', 'Black / Charcoal', 'Blue / Navy / Teal', 'White / Off-White', 'Green / Mint', 'Pink / Rose', 'Purple / Lilac', 'Transparent / Clear', 'Gradient / Dual color', 'Other', 'Not sure'],
      allow_detail: true,
      detail_placeholder: 'Color shade or dual tone'
    },
    {
      key: 'bottle_type',
      label: 'Bottle Type & Material',
      type: 'choice',
      options: ['Insulated Stainless Steel Flask (keeps cold/hot)', 'Single-wall Steel / Aluminum bottle', 'Hard Plastic sports sipper (Tritan)', 'Clear glass bottle with silicone sleeve', 'Shaker bottle with mixing ball', 'Thermal coffee mug / tumbler with lid', 'Food lunchbox / container', 'Other', 'Not sure'],
      allow_detail: true,
      detail_placeholder: 'Material or lid mechanism'
    },
    {
      key: 'brand',
      label: 'Brand (if known)',
      type: 'choice',
      options: ['Milton', 'Cello', 'Borosil', 'Hydro Flask', 'Tupperware', 'Decathlon / Quechua', 'Signoraware', 'Generic / No visible brand', 'Other', 'Not sure'],
      allow_detail: true,
      detail_placeholder: 'Brand name or printed logo'
    },
    {
      key: 'distinguishing_feature',
      label: 'Sticker, Dent, or Distinguishing Mark',
      type: 'choice',
      options: ['Sticker(s) attached on body (club, quote, cartoon, etc.)', 'Dent on base or side from dropping', 'Name or initials written in marker / etched', 'Handle / loop strap on cap', 'Straw nozzle or flip lid mechanism', 'Scratches or peeling paint on coating', 'None / Clean condition', 'Other', 'Not sure'],
      allow_detail: true,
      detail_placeholder: 'Describe sticker, dent location, or lid color'
    }
  ],
  'Electronics': [
    {
      key: 'device_type',
      label: 'Type of Electronic Device',
      type: 'choice',
      options: ['Wireless Earbuds / Case (AirPods, Galaxy Buds, boAt)', 'Over-ear Headphones', 'Tablet / iPad / Drawing Pad', 'Smartwatch / Fitness Band', 'Power Bank / Portable Charger', 'Scientific Calculator (Casio, TI)', 'USB Flash Drive / Hard Drive', 'Laptop Charger / Phone Adapter & Cable', 'Other', 'Not sure'],
      allow_detail: true,
      detail_placeholder: 'Exact device type'
    },
    {
      key: 'brand',
      label: 'Brand / Manufacturer',
      type: 'choice',
      options: ['Apple', 'Samsung', 'boAt / Noise / Boult', 'Sony / JBL / Bose', 'Casio', 'Mi / Xiaomi', 'Realme', 'Anker / Ambrane', 'SanDisk', 'Other', 'Not sure'],
      allow_detail: true,
      detail_placeholder: 'Brand name'
    },
    {
      key: 'main_color',
      label: 'Color',
      type: 'choice',
      options: ['White', 'Black', 'Grey / Silver', 'Navy / Blue', 'Red', 'Pink / Rose', 'Green', 'Other', 'Not sure'],
      allow_detail: true,
      detail_placeholder: 'Color details'
    },
    {
      key: 'distinguishing_feature',
      label: 'Case, Strap, or Distinctive Mark',
      type: 'choice',
      options: ['Protective silicone sleeve on case', 'Sticker or drawing on surface', 'Silicone / Metal sport band (for watch)', 'Scratch, dent, or scuff mark', 'Keychain / carabiner clip attached', 'Missing one earbud or piece', 'None / Plain condition', 'Other', 'Not sure'],
      allow_detail: true,
      detail_placeholder: 'Describe case, sticker, or distinctive detail'
    }
  ],
  'Stationery & Books': [
    {
      key: 'item_type',
      label: 'Type of Stationery / Book',
      type: 'choice',
      options: ['Subject Notebook / Register / Spiral Pad', 'Course Textbook', 'Scientific Calculator', 'Pen / Pencil Pouch with instruments', 'Document Folder / Project File', 'Geometry / Drawing Instrument Box', 'Laboratory Journal / Record Book', 'Other', 'Not sure'],
      allow_detail: true,
      detail_placeholder: 'Subject name or title'
    },
    {
      key: 'main_color',
      label: 'Cover / Pouch Color',
      type: 'choice',
      options: ['Black / Dark cover', 'Blue cover', 'Red / Maroon cover', 'Green cover', 'Yellow / Orange cover', 'Printed / Graphic cover', 'Transparent / Clear folder', 'Other', 'Not sure'],
      allow_detail: true,
      detail_placeholder: 'Cover design or color'
    },
    {
      key: 'name_written',
      label: 'Name or Roll Number Written on Item',
      type: 'choice',
      options: ['Yes, name / roll number on front cover label', 'Yes, name written on inside first page', 'Yes, name written on back or spine', 'No name or student identifier written', 'Other', 'Not sure'],
      allow_detail: true,
      detail_placeholder: 'Name as written on the item'
    },
    {
      key: 'distinguishing_mark',
      label: 'Subject, Title, or Distinctive Detail',
      type: 'choice',
      options: ['Engineering / Math / Science subject notes', 'Management / Humanities subject notes', 'Stickers on cover or pouch', 'Sticky notes / index bookmarks inside', 'Hardcover binding', 'Spiral bound register', 'Other', 'Not sure'],
      allow_detail: true,
      detail_placeholder: 'Subject, semester, or teacher name mentioned'
    }
  ],
  'Clothing & Accessories': [
    {
      key: 'apparel_type',
      label: 'Type of Apparel / Accessory',
      type: 'choice',
      options: ['Jacket / Windbreaker / Coat', 'Hoodie / Sweatshirt', 'Cardigan / Sweater', 'Cap / Beanie / Hat', 'Scarf / Muffler / Stole', 'Eyeglasses / Sunglasses in case', 'Umbrella', 'Wristwatch', 'Belt', 'Other', 'Not sure'],
      allow_detail: true,
      detail_placeholder: 'Apparel item type'
    },
    {
      key: 'main_color',
      label: 'Primary Color & Pattern',
      type: 'choice',
      options: ['Solid Black', 'Solid Navy / Blue', 'Grey / Charcoal', 'Olive / Army Green', 'Maroon / Red', 'Beige / White / Cream', 'Striped / Checked pattern', 'Printed / Graphic pattern', 'Other', 'Not sure'],
      allow_detail: true,
      detail_placeholder: 'Color or pattern details'
    },
    {
      key: 'brand',
      label: 'Brand (if visible on tag or front)',
      type: 'choice',
      options: ['Nike / Adidas / Puma', 'H&M / Zara', 'Decathlon / Quechua', 'Levi’s / Wrangler', 'College / Department branded merchandise', 'Generic / No prominent brand', 'Other', 'Not sure'],
      allow_detail: true,
      detail_placeholder: 'Brand name'
    },
    {
      key: 'distinguishing_mark',
      label: 'Size, Hood, Zipper, or Distinctive Mark',
      type: 'choice',
      options: ['Has hood and front kangaroo pocket', 'Full front zip', 'College department or club embroidery', 'Pin or badge on lapel / chest', 'Name / initials written on inner tag', 'Patch, tear, or missing button', 'None / Plain style', 'Other', 'Not sure'],
      allow_detail: true,
      detail_placeholder: 'Size tag or distinctive detail'
    }
  ],
  'Jewellery & Watches': [
    {
      key: 'item_type',
      label: 'Item Type',
      type: 'choice',
      options: ['Wristwatch (Analog)', 'Smartwatch / Fitness tracker', 'Ring (Finger ring / Band)', 'Bracelet / Bangle / Kada', 'Chain / Necklace / Pendant', 'Earrings / Studs', 'Other', 'Not sure'],
      allow_detail: true,
      detail_placeholder: 'Item description'
    },
    {
      key: 'metal_color',
      label: 'Metal Tone / Main Color',
      type: 'choice',
      options: ['Silver / Steel tone', 'Gold tone / Yellow gold', 'Rose Gold', 'Black metal / Matte black', 'Leather strap (black/brown)', 'Beaded / Thread / Fabric cord', 'Other', 'Not sure'],
      allow_detail: true,
      detail_placeholder: 'Tone or strap color'
    },
    {
      key: 'brand_style',
      label: 'Brand / Design Style',
      type: 'choice',
      options: ['Casio / Fastrack / Titan / Timex', 'Fossil / Tommy Hilfiger', 'Apple / Samsung / Noise watch', 'Traditional / Religious design', 'Minimalist plain band', 'Stone / Crystal embedded', 'Other', 'Not sure'],
      allow_detail: true,
      detail_placeholder: 'Brand or design pattern'
    },
    {
      key: 'distinguishing_mark',
      label: 'Engraving, Scratch, or Distinctive Detail',
      type: 'choice',
      options: ['Initials or date engraved inside / on back', 'Distinctive dial color or patterned face', 'Scratch on watch glass / metal surface', 'Unique clasp or magnetic lock', 'Small gemstone or pearl', 'None / Plain surface', 'Other', 'Not sure'],
      allow_detail: true,
      detail_placeholder: 'Engraved text or scratch location'
    }
  ],
  'Sports & Fitness': [
    {
      key: 'equipment_type',
      label: 'Type of Sports Equipment',
      type: 'choice',
      options: ['Badminton / Tennis Racket & Cover', 'Football / Basketball / Volleyball', 'Cricket Bat / Kit piece', 'Gym shaker / Protein bottle', 'Yoga Mat / Exercise mat in carry bag', 'Sports shoes / Cleats', 'Gym gloves / Wrist wraps / Resistance band', 'Swimming goggles / Cap', 'Other', 'Not sure'],
      allow_detail: true,
      detail_placeholder: 'Specific equipment type'
    },
    {
      key: 'main_color',
      label: 'Main Color',
      type: 'choice',
      options: ['Black', 'Blue / Navy', 'Red', 'Neon Green / Yellow', 'White', 'Multi-colored', 'Other', 'Not sure'],
      allow_detail: true,
      detail_placeholder: 'Color description'
    },
    {
      key: 'brand',
      label: 'Brand',
      type: 'choice',
      options: ['Yonex / Li-Ning', 'Nivia / Cosco', 'Decathlon / Artengo / Kipsta', 'Nike / Adidas / Puma', 'Wilson / Head', 'Generic / No brand', 'Other', 'Not sure'],
      allow_detail: true,
      detail_placeholder: 'Brand name'
    },
    {
      key: 'distinguishing_mark',
      label: 'Grip Color, Cover, or Distinctive Mark',
      type: 'choice',
      options: ['Grip tape color on handle (black, red, neon, etc.)', 'Stored inside zipped branded cover bag', 'Name / initials written in marker', 'Scuff marks / paint chipped on frame', 'None / Plain condition', 'Other', 'Not sure'],
      allow_detail: true,
      detail_placeholder: 'Grip color or initials'
    }
  ],
  'Documents & ID': [
    {
      key: 'document_type',
      label: 'Document Type',
      type: 'choice',
      options: ['College Student ID Card', 'National ID / Aadhaar Card', 'Driver’s License', 'Passport', 'Academic Marksheet / Degree Certificate', 'Bank Passbook / Chequebook', 'Hall Ticket / Exam Admit Card', 'Folder containing multiple official papers', 'Other', 'Not sure'],
      allow_detail: true,
      detail_placeholder: 'Document category'
    },
    {
      key: 'holder_color',
      label: 'Lanyard, Folder, or Cover Color',
      type: 'choice',
      options: ['College neck lanyard attached', 'Transparent plastic card sleeve', 'Blue folder / envelope', 'Yellow / Brown document envelope', 'Clear file folder with pockets', 'No cover / Loose card', 'Other', 'Not sure'],
      allow_detail: true,
      detail_placeholder: 'Folder or holder color'
    },
    {
      key: 'name_on_doc',
      label: 'Name on Document',
      type: 'choice',
      options: ['Yes, my name is printed clearly on it', 'Yes, contains passport photo of owner', 'Document has handwritten student details', 'Other', 'Not sure'],
      allow_detail: true,
      detail_placeholder: 'Full name printed on document (helps verify ownership)'
    },
    {
      key: 'distinguishing_mark',
      label: 'Department, Year, or Distinctive Mark',
      type: 'choice',
      options: ['Department / branch printed on ID card', 'Current academic year / semester indicated', 'Hologram or official college seal present', 'Sticker, tape, or lamination on card', 'Other', 'Not sure'],
      allow_detail: true,
      detail_placeholder: 'Department or graduation year'
    }
  ],
  'Other': [
    {
      key: 'item_nature',
      label: 'What kind of item is this?',
      type: 'choice',
      options: ['Personal accessory / Eyewear', 'Academic or project material', 'Musical instrument / Audio gear', 'Medical item (inhaler, glasses case, medicines)', 'Tools / Hardware', 'Umbrella / Rain gear', 'Miscellaneous campus item', 'Other', 'Not sure'],
      allow_detail: true,
      detail_placeholder: 'Briefly classify what the item is'
    },
    {
      key: 'main_color',
      label: 'Primary Visible Color',
      type: 'choice',
      options: ['Black', 'White / Cream', 'Blue / Navy', 'Red / Maroon', 'Green / Olive', 'Grey / Silver', 'Brown / Tan', 'Multi-colored', 'Other', 'Not sure'],
      allow_detail: true,
      detail_placeholder: 'Color details'
    },
    {
      key: 'brand_material',
      label: 'Brand or Material',
      type: 'choice',
      options: ['Plastic / Polymer', 'Metal / Alloy', 'Fabric / Cloth', 'Leather / Faux-leather', 'Wood / Bamboo', 'Glass / Ceramic', 'Other', 'Not sure'],
      allow_detail: true,
      detail_placeholder: 'Brand name or material'
    },
    {
      key: 'distinguishing_mark',
      label: 'Any Sticker, Scratch, or Distinctive Mark',
      type: 'choice',
      options: ['Name, initials, or handwriting visible', 'Sticker, tape, or label attached', 'Scratch, crack, or dent from usage', 'Pouch, sleeve, or case included', 'None / Plain condition', 'Other', 'Not sure'],
      allow_detail: true,
      detail_placeholder: 'Describe any distinctive mark'
    }
  ],
  'Headphones & Earphones': [
    {
      key: 'form_factor',
      label: 'Headphone Type / Form Factor',
      type: 'choice',
      options: ['TWS Wireless Earbuds with Charging Case (AirPods, Galaxy Buds)', 'Over-ear / On-ear Headphones (Padded headband)', 'Neckband Style In-ear Earphones', 'Wired 3.5mm / Type-C Earphones', 'Single Wireless Earpiece', 'Other', 'Not sure'],
      allow_detail: true,
      detail_placeholder: 'Describe form factor or style'
    },
    {
      key: 'brand',
      label: 'Brand / Manufacturer',
      type: 'choice',
      options: ['Apple (AirPods / AirPods Pro)', 'boAt (Airdopes / Rockerz)', 'Sony (WH-1000XM / WF series)', 'JBL', 'OnePlus (Bullets / Buds)', 'Samsung Galaxy Buds', 'Noise / Boult / Realme', 'Sennheiser / Bose', 'Generic / Unbranded', 'Other', 'Not sure'],
      allow_detail: true,
      detail_placeholder: 'Brand and model series'
    },
    {
      key: 'main_color',
      label: 'Earphone & Case Color',
      type: 'choice',
      options: ['White / Glossy White', 'Black / Matte Black', 'Blue / Navy', 'Grey / Silver', 'Beige / Rose Gold', 'Green / Olive', 'Dual-tone / Multi-colored', 'Other', 'Not sure'],
      allow_detail: true,
      detail_placeholder: 'Color shade or dual tone'
    },
    {
      key: 'distinguishing_feature',
      label: 'Protective Case, Keychain, or Distinctive Mark',
      type: 'choice',
      options: ['Silicone protective sleeve on charging case', 'Keychain, carabiner, or charm loop attached', 'Sticker, tape, or initials on case lid', 'Noticeable scratch, scuff, or dent', 'One earbud missing (only left or right present)', 'Ear hook or custom foam ear-tips installed', 'None / Clean original case', 'Other', 'Not sure'],
      allow_detail: true,
      detail_placeholder: 'Describe silicone case color, sticker, or mark'
    }
  ],
  'Chargers & Cables': [
    {
      key: 'charger_type',
      label: 'Type of Charger / Cable',
      type: 'choice',
      options: ['Laptop Power Brick & Cable (Type-C or barrel pin)', 'Smartphone Fast Charger (Wall adapter & USB-C cable)', 'iPhone Fast Charger / Lightning / MagSafe Cable', 'Multi-port GaN Fast Charger Block', 'Charging Cable Only (No wall adapter)', 'Power Bank / Portable Battery Pack', 'Other', 'Not sure'],
      allow_detail: true,
      detail_placeholder: 'Specify adapter or cable type'
    },
    {
      key: 'brand',
      label: 'Brand / Compatible Brand',
      type: 'choice',
      options: ['Apple (20W / 30W / 67W / MagSafe)', 'Samsung (25W / 45W Fast Charger)', 'Dell / HP / Lenovo (Laptop adapter)', 'OnePlus / Realme (Warp / Dart charger)', 'Xiaomi / Redmi fast charger', 'Anker / Ambrane / boAt', 'Generic / Unbranded power adapter', 'Other', 'Not sure'],
      allow_detail: true,
      detail_placeholder: 'Brand name or power rating'
    },
    {
      key: 'main_color',
      label: 'Adapter & Cable Color',
      type: 'choice',
      options: ['White (White block & white wire)', 'Black (Black block & black wire)', 'Braided Grey / Silver cable', 'Red / Orange cable (OnePlus style)', 'Blue / Colored accent', 'Other', 'Not sure'],
      allow_detail: true,
      detail_placeholder: 'Color or braided wire details'
    },
    {
      key: 'distinguishing_feature',
      label: 'Cable Tie, Tape, or Distinctive Mark',
      type: 'choice',
      options: ['Colored tape or wire marker near connector', 'Velcro cable tie or rubber band attached', 'Name, initials, or symbol in permanent marker', 'Bent charging pin or strain-relief fraying', 'Scratch, dent, or sticker on charger body', 'None / Clean condition', 'Other', 'Not sure'],
      allow_detail: true,
      detail_placeholder: 'Describe tape color, initials, or mark'
    }
  ],
  'Helmets & Riding Gear': [
    {
      key: 'helmet_type',
      label: 'Helmet Style / Gear Type',
      type: 'choice',
      options: ['Full-face Helmet with chin bar', 'Open-face (3/4th) Helmet with visor', 'Modular / Flip-up Helmet', 'Half Helmet / Beanie style', 'Bicycle / Skate Helmet', 'Riding Gloves / Knee Guards / Jacket', 'Other', 'Not sure'],
      allow_detail: true,
      detail_placeholder: 'Specific helmet or gear style'
    },
    {
      key: 'brand',
      label: 'Brand',
      type: 'choice',
      options: ['Vega', 'Steelbird', 'Studds', 'Axor', 'SMK', 'Royal Enfield', 'MT Helmets', 'Generic / No prominent logo', 'Other', 'Not sure'],
      allow_detail: true,
      detail_placeholder: 'Helmet brand and series'
    },
    {
      key: 'main_color',
      label: 'Primary Color & Finish',
      type: 'choice',
      options: ['Matte Black', 'Glossy Black', 'White / Pearl White', 'Red / Maroon', 'Neon Green / Yellow / High-vis', 'Graphic Decals / Racing stripes / Multi-color', 'Grey / Titanium', 'Other', 'Not sure'],
      allow_detail: true,
      detail_placeholder: 'Color and finish or graphic pattern'
    },
    {
      key: 'distinguishing_feature',
      label: 'Visor Tint, Stickers, or Distinguishing Mark',
      type: 'choice',
      options: ['Smoked / Black-tinted sun visor installed', 'Clear transparent visor', 'Rainbow / Mercury reflective mirror visor', 'Action camera mount or intercom / mic attached', 'Stickers, club logos, or blood group decal on shell', 'Deep scratch, paint chip, or scuff mark', 'None / Clean pristine condition', 'Other', 'Not sure'],
      allow_detail: true,
      detail_placeholder: 'Describe sticker, visor type, or scratch location'
    }
  ],
  'Vehicle Keys': [
    {
      key: 'vehicle_type',
      label: 'What type of vehicle was the key for?',
      type: 'choice',
      options: ['Motorcycle', 'Scooty', 'Car', 'Other vehicle', 'Other', 'Not sure'],
      allow_detail: true,
      detail_placeholder: 'Specify vehicle make or model if known'
    },
    {
      key: 'key_type',
      label: 'What type of key was it?',
      type: 'choice',
      options: ['Traditional metal key', 'Remote key fob', 'Smart / proximity key', 'Key with integrated remote', 'Other', 'Not sure'],
      allow_detail: true,
      detail_placeholder: 'Describe key shape or remote type if Other'
    },
    {
      key: 'key_appearance',
      label: 'What did the key or remote look like?',
      type: 'choice',
      options: ['Mainly black', 'Mainly silver or metallic', 'Distinctive coloured buttons or casing', 'Other colour', 'Other', 'Not sure'],
      allow_detail: true,
      detail_placeholder: 'Describe colour, casing design, or button layout'
    },
    {
      key: 'distinguishing_feature',
      label: 'Was there a distinctive feature?',
      type: 'choice',
      options: ['Keychain or tag attached', 'Multiple keys on the same ring', 'Distinctive casing or cover', 'Visible logo or marking', 'No obvious distinctive feature', 'Other', 'Not sure'],
      allow_detail: true,
      detail_placeholder: 'Describe keychain, logo, or any distinctive mark'
    }
  ]
};

// Aliases mapping — must match backend question_bank.py CATEGORY_ALIASES
const CATEGORY_MAP: Record<string, string> = {
  'phone': 'Phone',
  'phones': 'Phone',
  'smartphone': 'Phone',
  'smartphones': 'Phone',
  'mobile': 'Phone',
  'laptop': 'Laptop',
  'laptops': 'Laptop',
  'backpack & bags': 'Backpack & Bags',
  'bags & luggage': 'Backpack & Bags',
  'backpack': 'Backpack & Bags',
  'backpacks': 'Backpack & Bags',
  'bag': 'Backpack & Bags',
  'bags': 'Backpack & Bags',
  'wallet & cards': 'Wallet & Cards',
  'wallet': 'Wallet & Cards',
  'wallets': 'Wallet & Cards',
  // Vehicle Keys aliases — specific to vehicle keys, distinct from generic key/badge
  'vehicle keys': 'Vehicle Keys',
  'vehicle key': 'Vehicle Keys',
  'vehicle_keys': 'Vehicle Keys',
  'motorcycle key': 'Vehicle Keys',
  'motorbike key': 'Vehicle Keys',
  'scooter key': 'Vehicle Keys',
  'scooty key': 'Vehicle Keys',
  'scooty': 'Vehicle Keys',
  'car key': 'Vehicle Keys',
  'car keys': 'Vehicle Keys',
  'bike key': 'Vehicle Keys',
  'key fob': 'Vehicle Keys',
  'key fobs': 'Vehicle Keys',
  'remote key': 'Vehicle Keys',
  'smart key': 'Vehicle Keys',
  'proximity key': 'Vehicle Keys',
  'keys & badges': 'Keys & Badges',
  'keys': 'Keys & Badges',
  'key': 'Keys & Badges',
  'bottles & containers': 'Bottles & Containers',
  'bottle': 'Bottles & Containers',
  'bottles': 'Bottles & Containers',
  'headphones & earphones': 'Headphones & Earphones',
  'headphones': 'Headphones & Earphones',
  'headphone': 'Headphones & Earphones',
  'earphones': 'Headphones & Earphones',
  'earphone': 'Headphones & Earphones',
  'earbuds': 'Headphones & Earphones',
  'airpods': 'Headphones & Earphones',
  'chargers & cables': 'Chargers & Cables',
  'chargers': 'Chargers & Cables',
  'charger': 'Chargers & Cables',
  'adapter': 'Chargers & Cables',
  'cables': 'Chargers & Cables',
  'cable': 'Chargers & Cables',
  'helmets & riding gear': 'Helmets & Riding Gear',
  'helmets': 'Helmets & Riding Gear',
  'helmet': 'Helmets & Riding Gear',
  'riding gear': 'Helmets & Riding Gear',
  'electronics': 'Electronics',
  'other electronics': 'Electronics',
  'gadget': 'Electronics',
  'stationery & books': 'Stationery & Books',
  'stationery': 'Stationery & Books',
  'book': 'Stationery & Books',
  'books': 'Stationery & Books',
  'clothing & accessories': 'Clothing & Accessories',
  'clothing': 'Clothing & Accessories',
  'jewellery & watches': 'Jewellery & Watches',
  'jewellery': 'Jewellery & Watches',
  'jewelry': 'Jewellery & Watches',
  'sports & fitness': 'Sports & Fitness',
  'sports': 'Sports & Fitness',
  'documents & id': 'Documents & ID',
  'documents & ID': 'Documents & ID',
  'documents': 'Documents & ID',
  'other': 'Other',
};


// Steps: 0 = Category, 1 = Details, 2 = Location & Time, 3 = Review
const STEPS = ['Category', 'Questions', 'Location & Time', 'Review'];

export const ReportLostItemPage: React.FC = () => {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);

  // Step 0: Category
  const [category, setCategory] = useState('');

  // Step 1: Description + MCQs
  const [description, setDescription] = useState('');
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [details, setDetails] = useState<Record<string, string>>({});

  // Step 2: Location / Time
  const [lostDate, setLostDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [lostTime, setLostTime] = useState('');
  const [lostLocation, setLostLocation] = useState('');

  // Step 3: Image (optional)
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);

  const [formError, setFormError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [submittedReportId, setSubmittedReportId] = useState<string | null>(null);

  // Load question bank from backend API
  const { data: apiQuestionBank } = useQuery<QuestionBankResponse>({
    queryKey: ['category-question-bank'],
    queryFn: async () => api.get<QuestionBankResponse>('/api/items/category-questions/'),
    staleTime: 60000,
  });

  // Resolve questions for selected category
  const resolvedCategoryKey = CATEGORY_MAP[category.toLowerCase()] || 'Other';
  const questions: CategoryQuestion[] =
    apiQuestionBank?.questions?.[resolvedCategoryKey] ||
    FALLBACK_QUESTION_BANK[resolvedCategoryKey] ||
    FALLBACK_QUESTION_BANK['Other'];

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setImageFile(file);
      const reader = new FileReader();
      reader.onload = (ev) => setImagePreview(ev.target?.result as string);
      reader.readAsDataURL(file);
    }
  };

  const submitMutation = useMutation({
    mutationFn: async () => {
      // Build normalized attributes for scoring
      const normalizedAttributes: Record<string, string> = {};
      const snapshotQuestions = questions.map(q => {
        const selectedVal = answers[q.key] || '';
        const detailVal = details[q.key] || '';
        if (selectedVal && !['Not sure', 'None / Clean condition', 'None / Plain pristine lid', 'None / Plain bag', 'None / Plain surface', 'None'].includes(selectedVal)) {
          normalizedAttributes[q.key] = detailVal ? `${selectedVal} (${detailVal})` : selectedVal;
        }
        return {
          key: q.key,
          label: q.label,
          options: q.options,
          selected: selectedVal || null,
          detail: detailVal || null,
        };
      });

      const originalAnswersPayload = {
        version: apiQuestionBank?.version || '2026.1',
        category: resolvedCategoryKey,
        questions: snapshotQuestions,
        answers: { ...answers },
        details: { ...details },
        lost_location: lostLocation,
        lost_date: lostDate,
        lost_time: lostTime,
      };

      const formData = new FormData();
      formData.append('category', resolvedCategoryKey);
      formData.append('description', description);
      formData.append('original_answers', JSON.stringify(originalAnswersPayload));
      formData.append('normalized_attributes', JSON.stringify(normalizedAttributes));
      if (imageFile) formData.append('image', imageFile);

      const created = await apiRequest<{ id: number; public_id: string }>('/api/items/lost-items/', {
        method: 'POST',
        body: formData,
        headers: {},
      });
      return created;
    },
    onSuccess: (data) => {
      setSubmittedReportId(data?.public_id || null);
      setSubmitted(true);
      setFormError(null);
    },
    onError: (err: ApiError) => {
      setFormError(err.message || 'Failed to submit lost item report. Please try again.');
    },
  });

  const canNext = () => {
    if (step === 0) return !!category;
    if (step === 1) return description.trim().length > 0;
    return true;
  };

  const next = () => {
    setFormError(null);
    if (!canNext()) {
      if (step === 0) setFormError('Please select a category for your lost item.');
      if (step === 1) setFormError('Please provide a brief description of what you lost.');
      return;
    }
    setStep(s => s + 1);
  };

  const back = () => {
    setFormError(null);
    setStep(s => s - 1);
  };

  if (submitted) {
    return (
      <div className="max-w-xl mx-auto px-4 py-16 text-center">
        <div className="bg-white border border-slate-200 rounded-2xl p-8 sm:p-10 shadow-sm space-y-5">
          <div className="w-16 h-16 rounded-full bg-emerald-50 border border-emerald-200 flex items-center justify-center mx-auto">
            <CheckCircle2 className="w-9 h-9 text-emerald-600" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900">Lost Report Filed Successfully</h1>
          <p className="text-sm text-slate-600 leading-relaxed max-w-md mx-auto">
            "Your report could help bring your belongings back."
            Reunite's matching engine is now monitoring newly deposited campus items.
          </p>

          {submittedReportId && (
            <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl max-w-sm mx-auto text-center space-y-1">
              <span className="text-[11px] font-bold text-blue-700 uppercase tracking-wider block">Unique Report Reference ID</span>
              <p className="font-mono font-extrabold text-lg text-blue-900">{submittedReportId}</p>
              <p className="text-[11px] text-slate-500">Provide this ID to custodial desks to quickly locate your case.</p>
            </div>
          )}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-4">
            <button
              onClick={() => navigate('/dashboard')}
              className="w-full sm:w-auto px-5 py-2.5 text-sm font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors"
            >
              Back to Dashboard
            </button>
            <button
              onClick={() => navigate('/found-items')}
              className="w-full sm:w-auto px-5 py-2.5 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition-colors shadow-xs"
            >
              Browse Found Items Catalog
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8 space-y-6">
      {/* Header with Engaging Encouraging Message */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs">
        <div className="flex items-center gap-2 text-xs text-blue-700 font-semibold mb-1">
          <Sparkles className="w-4 h-4" />
          <span>I Lost Something · Smart Campus Recovery</span>
        </div>
        <h1 className="text-2xl font-bold text-slate-900">
          Lost something? Let's help you find it.
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          Tell us what you lost. Reunite will compare your answers against official campus holding desks to find a verified match.
        </p>
      </div>

      {/* Progress Steps Indicator */}
      <div className="flex items-center justify-between px-2">
        {STEPS.map((label, idx) => (
          <React.Fragment key={label}>
            <div className="flex flex-col items-center">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all ${idx < step
                  ? 'bg-emerald-600 text-white'
                  : idx === step
                    ? 'bg-blue-600 text-white ring-4 ring-blue-100'
                    : 'bg-slate-100 text-slate-400 border border-slate-200'
                }`}>
                {idx < step ? <CheckCircle2 className="w-4 h-4" /> : idx + 1}
              </div>
              <span className={`text-[11px] mt-1 font-medium ${idx === step ? 'text-blue-700 font-semibold' : 'text-slate-400'}`}>
                {label}
              </span>
            </div>
            {idx < STEPS.length - 1 && (
              <div className={`flex-1 h-0.5 mx-1 mt-[-14px] transition-colors ${idx < step ? 'bg-emerald-500' : 'bg-slate-200'}`} />
            )}
          </React.Fragment>
        ))}
      </div>

      {/* Form Error Banner */}
      {formError && (
        <div className="flex items-start gap-2.5 p-3.5 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-red-600" />
          <span>{formError}</span>
        </div>
      )}

      {/* ── STEP 0: CATEGORY SELECTION ────────────────────────────────────── */}
      {step === 0 && (
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-4">
          <div>
            <h2 className="text-lg font-bold text-slate-900">Step 1: What did you lose?</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Select the category below. We'll present 3–4 tailored questions to accurately distinguish your item.
            </p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 pt-1">
            {CATEGORIES.map(cat => (
              <button
                key={cat}
                type="button"
                onClick={() => { setCategory(cat); setAnswers({}); setDetails({}); setStep(1); }}
                className={`p-3.5 rounded-xl border text-sm font-semibold text-left transition-all ${category === cat
                    ? 'border-blue-600 bg-blue-50/80 text-blue-900 shadow-xs ring-2 ring-blue-500'
                    : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50'
                  }`}
              >
                {cat}
              </button>

            ))}
          </div>
        </div>
      )}

      {/* ── STEP 1: CATEGORY SPECIFIC MCQS & DESCRIPTION ────────────────── */}
      {step === 1 && (
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-6">
          <div className="border-b border-slate-100 pb-3">
            <span className="text-xs font-bold text-blue-700 uppercase tracking-wider">
              {resolvedCategoryKey} Identification Questions
            </span>
            <h2 className="text-lg font-bold text-slate-900 mt-0.5">
              Tell us about your {resolvedCategoryKey.toLowerCase()}
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Answer the multiple-choice questions below. Select "Not sure" if you don't remember — uncertainty never stops your report.
            </p>
          </div>

          {/* General Description */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5 uppercase tracking-wide">
              General Description <span className="text-red-500">*</span>
            </label>
            <textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g. Left my blue Dell Inspiron laptop in the library 2nd floor reading hall around 2 PM..."
              className="w-full px-3.5 py-2.5 text-sm border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white transition-colors"
            />
          </div>

          {/* 3-4 Category Specific MCQs */}
          <div className="space-y-5 pt-2">
            {questions.map((q, idx) => (
              <div key={q.key} className="p-4 bg-slate-50/80 border border-slate-200 rounded-xl space-y-2.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-800">
                    Question {idx + 1}: {q.label}
                  </label>
                </div>

                <div className="relative">
                  <select
                    value={answers[q.key] || ''}
                    onChange={(e) => setAnswers(prev => ({ ...prev, [q.key]: e.target.value }))}
                    className="w-full appearance-none px-3.5 py-2.5 text-sm border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white pr-9 text-slate-800"
                  >
                    <option value="">Select an option…</option>
                    {q.options.map(opt => (
                      <option key={opt} value={opt}>{opt}</option>
                    ))}
                  </select>
                  <ChevronDown className="w-4 h-4 absolute right-3 top-3 text-slate-400 pointer-events-none" />
                </div>

                {/* Optional detail field if user selected "Other" or wants to add custom detail */}
                {(answers[q.key] === 'Other' || details[q.key]) && (
                  <div className="pt-1">
                    <input
                      type="text"
                      value={details[q.key] || ''}
                      onChange={(e) => setDetails(prev => ({ ...prev, [q.key]: e.target.value }))}
                      placeholder={q.detail_placeholder || 'Provide additional detail (optional)...'}
                      className="w-full px-3 py-2 text-xs border border-blue-200 bg-blue-50/30 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── STEP 2: LOCATION & TIME ───────────────────────────────────────── */}
      {step === 2 && (
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-5">
          <div>
            <h2 className="text-lg font-bold text-slate-900">Where and when was it lost?</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Approximate campus location and date help custodians search the correct building holding desk.
            </p>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5 uppercase tracking-wide">
              Approximate Campus Location
            </label>
            <input
              type="text"
              value={lostLocation}
              onChange={(e) => setLostLocation(e.target.value)}
              placeholder="e.g. Central Library 2nd floor, Canteen Block B, Science Lab 102..."
              className="w-full px-3.5 py-2.5 text-sm border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5 uppercase tracking-wide">
                Date Lost
              </label>
              <input
                type="date"
                value={lostDate}
                onChange={(e) => setLostDate(e.target.value)}
                className="w-full px-3.5 py-2.5 text-sm border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5 uppercase tracking-wide">
                Approximate Time (optional)
              </label>
              <input
                type="time"
                value={lostTime}
                onChange={(e) => setLostTime(e.target.value)}
                className="w-full px-3.5 py-2.5 text-sm border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              />
            </div>
          </div>

          {/* Optional Reference Photo */}
          <div className="border-t border-slate-100 pt-4">
            <label className="block text-xs font-semibold text-slate-700 mb-2 uppercase tracking-wide">
              Optional Reference Photo
              <span className="text-[11px] text-slate-400 font-normal lowercase ml-2">(past photo of the item or its packaging)</span>
            </label>

            {imagePreview ? (
              <div className="relative w-36 h-36 rounded-xl overflow-hidden border border-slate-200">
                <img src={imagePreview} alt="Lost reference" className="w-full h-full object-cover" />
                <button
                  type="button"
                  onClick={() => { setImageFile(null); setImagePreview(null); }}
                  className="absolute top-1.5 right-1.5 p-1 bg-white rounded-full shadow border border-slate-200 text-slate-500 hover:text-red-600"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <label className="flex items-center gap-3 cursor-pointer p-3.5 border-2 border-dashed border-slate-300 rounded-xl hover:border-blue-400 hover:bg-blue-50/20 transition-colors">
                <Upload className="w-5 h-5 text-slate-400" />
                <span className="text-xs text-slate-600 font-medium">Click to upload a reference photo (JPG, PNG, WEBP)</span>
                <input type="file" accept="image/*" className="hidden" onChange={handleImageChange} />
              </label>
            )}
          </div>
        </div>
      )}

      {/* ── STEP 3: REVIEW & CONFIRM ──────────────────────────────────────── */}
      {step === 3 && (
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-5">
          <div className="border-b border-slate-100 pb-3">
            <h2 className="text-lg font-bold text-slate-900">Review your report</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Confirm your answers before submitting. You can edit your report later from your dashboard.
            </p>
          </div>

          <div className="space-y-4 divide-y divide-slate-100">
            <div>
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Category</span>
              <p className="text-sm font-bold text-slate-900 mt-0.5">{resolvedCategoryKey}</p>
            </div>

            <div className="pt-3">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Description</span>
              <p className="text-sm text-slate-800 mt-0.5 whitespace-pre-wrap">{description}</p>
            </div>

            {/* Answered MCQs */}
            <div className="pt-3">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Identification Answers</span>
              <div className="mt-1.5 space-y-2">
                {questions.map(q => {
                  const ans = answers[q.key];
                  const dtl = details[q.key];
                  return (
                    <div key={q.key} className="p-2.5 bg-slate-50 rounded-lg text-xs">
                      <span className="font-semibold text-slate-700">{q.label}: </span>
                      <span className="font-bold text-blue-900">{ans || 'Not specified'}</span>
                      {dtl && <span className="text-slate-500 ml-1">({dtl})</span>}
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="pt-3">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Location &amp; Date</span>
              <p className="text-sm text-slate-800 mt-0.5">
                {lostLocation || 'Not specified'}{lostDate ? ` · ${lostDate}` : ''}{lostTime ? ` at ${lostTime}` : ''}
              </p>
            </div>

            {imagePreview && (
              <div className="pt-3">
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Reference Photo</span>
                <img src={imagePreview} alt="Reference" className="mt-1.5 w-24 h-24 object-cover rounded-xl border border-slate-200" />
              </div>
            )}
          </div>
        </div>
      )}

      {/* Navigation Buttons */}
      <div className="flex items-center justify-between pt-2">
        <button
          type="button"
          onClick={step === 0 ? () => navigate('/dashboard') : back}
          className="flex items-center gap-1.5 px-4 py-2.5 text-xs font-semibold text-slate-700 border border-slate-300 rounded-xl hover:bg-slate-50 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          {step === 0 ? 'Cancel' : 'Back'}
        </button>

        {step < STEPS.length - 1 ? (
          <button
            type="button"
            onClick={next}
            className="flex items-center gap-1.5 px-5 py-2.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition-colors shadow-xs"
          >
            Continue
            <ArrowRight className="w-4 h-4" />
          </button>
        ) : (
          <button
            type="button"
            onClick={() => submitMutation.mutate()}
            disabled={submitMutation.isPending}
            id="submit-lost-report-btn"
            className="flex items-center gap-2 px-6 py-2.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 rounded-xl transition-colors shadow-xs"
          >
            {submitMutation.isPending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <CheckCircle2 className="w-4 h-4" />
            )}
            Submit Lost Report
          </button>
        )}
      </div>
    </div>
  );
};
