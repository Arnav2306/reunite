"""
Reunite Category-Specific Question Bank Service
===============================================
Defines high-fidelity, category-specific multiple-choice questions (MCQs)
for lost-item reports.

Each supported category contains 3–4 tailored questions with realistic options,
including 'Other' and 'Not sure' / 'None' to avoid blocking legitimate reports.
The service attaches version metadata ('2026.1') so historical reports retain
their exact questions and answers forever, even as question definitions evolve.
"""

from typing import Dict, List, Any, Optional

QUESTION_BANK_VERSION = '2026.1'

# Full category question definitions
CATEGORY_QUESTION_BANK: Dict[str, List[Dict[str, Any]]] = {
    'Phone': [
        {
            'key': 'brand',
            'label': 'Brand / Manufacturer',
            'type': 'choice',
            'options': [
                'Apple (iPhone)',
                'Samsung Galaxy',
                'OnePlus',
                'Google Pixel',
                'Xiaomi / Redmi / Poco',
                'Realme',
                'Vivo',
                'Oppo',
                'Motorola',
                'Other',
                'Not sure'
            ],
            'allow_detail': True,
            'detail_placeholder': 'Specify brand if Other or specific model series'
        },
        {
            'key': 'main_color',
            'label': 'Body / Back Color',
            'type': 'choice',
            'options': [
                'Black / Space Grey',
                'White / Silver',
                'Blue / Navy',
                'Green / Olive',
                'Purple / Lavender',
                'Gold / Rose Gold',
                'Red',
                'Yellow / Coral',
                'Other',
                'Not sure'
            ],
            'allow_detail': True,
            'detail_placeholder': 'Describe finish or color shade'
        },
        {
            'key': 'case_style',
            'label': 'Case or Cover Style',
            'type': 'choice',
            'options': [
                'No case / Naked phone',
                'Transparent / Clear case',
                'Black / Dark silicone case',
                'Solid color silicone / hard case',
                'Patterned / Printed case',
                'Wallet / Flip cover with card slots',
                'Heavy-duty / Rugged bumper case',
                'Other',
                'Not sure'
            ],
            'allow_detail': True,
            'detail_placeholder': 'Describe case color, design, or card inside'
        },
        {
            'key': 'distinguishing_feature',
            'label': 'Distinguishing Exterior Feature',
            'type': 'choice',
            'options': [
                'Screen protector / tempered glass installed',
                'PopSocket or ring holder on back',
                'Sticker or photo behind transparent case',
                'Visible scratch or hairline crack on glass',
                'Dented or scuffed corner / frame',
                'Camera lens protector attached',
                'None / Clean condition',
                'Other',
                'Not sure'
            ],
            'allow_detail': True,
            'detail_placeholder': 'Describe sticker, crack location, or distinctive mark'
        }
    ],

    'Laptop': [
        {
            'key': 'brand',
            'label': 'Brand / Manufacturer',
            'type': 'choice',
            'options': [
                'Apple MacBook',
                'Dell (Inspiron / XPS / Latitude)',
                'Lenovo (ThinkPad / IdeaPad / Yoga)',
                'HP (Pavilion / Envy / Victus)',
                'ASUS (ZenBook / ROG / TUF / VivoBook)',
                'Acer (Aspire / Predator / Swift)',
                'MSI',
                'Microsoft Surface',
                'Other',
                'Not sure'
            ],
            'allow_detail': True,
            'detail_placeholder': 'Specify brand and series'
        },
        {
            'key': 'model_family',
            'label': 'Model Family / Screen Size',
            'type': 'choice',
            'options': [
                '13-inch Compact / Ultrabook',
                '14-inch Standard Thin & Light',
                '15-inch to 16-inch Standard / Gaming',
                '17-inch Large Laptop',
                '2-in-1 Touchscreen / Convertible',
                'MacBook Air',
                'MacBook Pro',
                'Other',
                'Not sure'
            ],
            'allow_detail': True,
            'detail_placeholder': 'Approximate model or processor badge if known'
        },
        {
            'key': 'main_color',
            'label': 'Exterior Body Color',
            'type': 'choice',
            'options': [
                'Silver / Aluminum',
                'Space Grey / Dark Grey',
                'Matte Black',
                'Midnight / Dark Blue',
                'White / Platinum',
                'Gold / Rose Gold',
                'Other',
                'Not sure'
            ],
            'allow_detail': True,
            'detail_placeholder': 'Color or finish details'
        },
        {
            'key': 'distinctive_mark',
            'label': 'Sticker, Sleeve, or Distinctive Mark',
            'type': 'choice',
            'options': [
                'Multiple stickers on lid (tech, college, anime, etc.)',
                'Single sticker or logo decal on lid',
                'Hard shell snap-on case attached',
                'Inside a zip laptop sleeve / bag',
                'Keyboard cover skin installed',
                'Noticeable dent, scratch, or scuff mark',
                'None / Plain pristine lid',
                'Other',
                'Not sure'
            ],
            'allow_detail': True,
            'detail_placeholder': 'Describe stickers, sleeve color, or mark location'
        }
    ],

    'Backpack & Bags': [
        {
            'key': 'main_color',
            'label': 'Main Color',
            'type': 'choice',
            'options': [
                'Black',
                'Navy / Dark Blue',
                'Grey / Charcoal',
                'Red / Maroon',
                'Green / Olive',
                'Brown / Tan',
                'Two-tone / Multi-colored',
                'Other',
                'Not sure'
            ],
            'allow_detail': True,
            'detail_placeholder': 'Color shade or dual colors'
        },
        {
            'key': 'brand',
            'label': 'Brand (if visible)',
            'type': 'choice',
            'options': [
                'Wildcraft',
                'American Tourister',
                'Skybags',
                'Nike / Adidas / Puma',
                'JanSport',
                'North Face',
                'Lenovo / HP / Dell laptop bag',
                'Decathlon / Quechua',
                'Unbranded / Generic',
                'Other',
                'Not sure'
            ],
            'allow_detail': True,
            'detail_placeholder': 'Brand name if known'
        },
        {
            'key': 'bag_type',
            'label': 'Bag Style & Material',
            'type': 'choice',
            'options': [
                'Standard College Backpack (polyester/nylon)',
                'Laptop Backpack with padded compartment',
                'Tote bag (canvas / cloth)',
                'Duffel / Gym bag',
                'Messenger / Crossbody sling bag',
                'Leather / Faux-leather bag',
                'Other',
                'Not sure'
            ],
            'allow_detail': True,
            'detail_placeholder': 'Style or compartment details'
        },
        {
            'key': 'distinguishing_feature',
            'label': 'Keychain, Tag, or Distinctive Mark',
            'type': 'choice',
            'options': [
                'Keychain or plushie charm attached to zipper',
                'Water bottle visible in side mesh pocket',
                'College pin, badge, or patch attached',
                'Luggage name tag / ribbon attached to handle',
                'Torn strap, broken zipper pull, or scuff mark',
                'None / Plain bag',
                'Other',
                'Not sure'
            ],
            'allow_detail': True,
            'detail_placeholder': 'Describe keychain, badge, or zipper pull'
        }
    ],

    'Wallet & Cards': [
        {
            'key': 'main_color',
            'label': 'Wallet Color',
            'type': 'choice',
            'options': [
                'Black',
                'Dark Brown',
                'Tan / Light Brown',
                'Blue / Navy',
                'Red / Burgundy',
                'Grey',
                'Other',
                'Not sure'
            ],
            'allow_detail': True,
            'detail_placeholder': 'Color shade or pattern'
        },
        {
            'key': 'material',
            'label': 'Material',
            'type': 'choice',
            'options': [
                'Genuine Leather',
                'Faux / Synthetic Leather (PU)',
                'Fabric / Canvas / Nylon',
                'Metal / Carbon Fiber cardholder',
                'Plastic / Silicone card sleeve',
                'Other',
                'Not sure'
            ],
            'allow_detail': True,
            'detail_placeholder': 'Material description'
        },
        {
            'key': 'wallet_style',
            'label': 'Wallet Style / Shape',
            'type': 'choice',
            'options': [
                'Classic Bifold (folds in half)',
                'Trifold (folds in three parts)',
                'Slim Cardholder / Money clip',
                'Long zip-around wallet / Clutch',
                'Coin pouch / Small pouch',
                'ID card lanyard with card sleeve',
                'Other',
                'Not sure'
            ],
            'allow_detail': True,
            'detail_placeholder': 'Shape or brand if known'
        },
        {
            'key': 'distinguishing_mark',
            'label': 'General Contents or Distinguishing Mark',
            'type': 'choice',
            'options': [
                'Contains College ID card (no numbers needed)',
                'Contains Metro / Transit card',
                'Contains driving licence or bank card',
                'Embossed logo or stitched brand emblem',
                'Elastic band or metal clip on exterior',
                'Noticeable wear or worn edges',
                'Other',
                'Not sure'
            ],
            'allow_detail': True,
            'detail_placeholder': 'General identifying detail without confidential numbers'
        }
    ],

    'Keys & Badges': [
        {
            'key': 'key_count_type',
            'label': 'Key Type & Approximate Count',
            'type': 'choice',
            'options': [
                'Single key (room or padlock)',
                '2 to 3 keys on a ring',
                '4 or more keys on a ring',
                'Bike / Motorcycle key',
                'Car key / Remote key fob',
                'Campus ID access card / RFID badge',
                'Combination of keys and ID badge',
                'Other',
                'Not sure'
            ],
            'allow_detail': True,
            'detail_placeholder': 'Vehicle brand, room number prefix, etc.'
        },
        {
            'key': 'keychain_presence',
            'label': 'Keychain Presence',
            'type': 'choice',
            'options': [
                'Yes, keychain / lanyard attached',
                'No keychain, just plain metallic key ring',
                'Single key with no ring or tag',
                'Other',
                'Not sure'
            ],
            'allow_detail': True,
            'detail_placeholder': 'Tag or ring details'
        },
        {
            'key': 'keychain_style_color',
            'label': 'Keychain Color & Style',
            'type': 'choice',
            'options': [
                'College lanyard / neck strap',
                'Fabric ribbon strap (red, black, blue, etc.)',
                'Metal logo or vehicle brand keychain',
                'Rubber / Silicon character or anime figurine',
                'Leather strap or loop',
                'Mini flashlight, bottle opener, or multi-tool',
                'Plastic room tag / numbered token',
                'No keychain / Plain ring',
                'Other',
                'Not sure'
            ],
            'allow_detail': True,
            'detail_placeholder': 'Describe keychain color, character, or text'
        },
        {
            'key': 'distinguishing_feature',
            'label': 'Distinguishing Mark or Engraving',
            'type': 'choice',
            'options': [
                'Room number stamped or written on key/tag',
                'Vehicle brand logo on key head (Honda, Yamaha, Suzuki, etc.)',
                'Colored plastic key topper / cap',
                'Mini carabiner / hook attached',
                'Bent or discolored key',
                'None / Plain metallic keys',
                'Other',
                'Not sure'
            ],
            'allow_detail': True,
            'detail_placeholder': 'Room number or specific logo'
        }
    ],

    'Bottles & Containers': [
        {
            'key': 'main_color',
            'label': 'Main Bottle Color',
            'type': 'choice',
            'options': [
                'Silver / Stainless Steel metallic',
                'Black / Charcoal',
                'Blue / Navy / Teal',
                'White / Off-White',
                'Green / Mint',
                'Pink / Rose',
                'Purple / Lilac',
                'Transparent / Clear',
                'Gradient / Dual color',
                'Other',
                'Not sure'
            ],
            'allow_detail': True,
            'detail_placeholder': 'Color shade or dual tone'
        },
        {
            'key': 'bottle_type',
            'label': 'Bottle Type & Material',
            'type': 'choice',
            'options': [
                'Insulated Stainless Steel Flask (keeps cold/hot)',
                'Single-wall Steel / Aluminum bottle',
                'Hard Plastic sports sipper (Tritan)',
                'Clear glass bottle with silicone sleeve',
                'Shaker bottle with mixing ball',
                'Thermal coffee mug / tumbler with lid',
                'Food lunchbox / container',
                'Other',
                'Not sure'
            ],
            'allow_detail': True,
            'detail_placeholder': 'Material or lid mechanism'
        },
        {
            'key': 'brand',
            'label': 'Brand (if known)',
            'type': 'choice',
            'options': [
                'Milton',
                'Cello',
                'Borosil',
                'Hydro Flask',
                'Tupperware',
                'Decathlon / Quechua',
                'Signoraware',
                'Generic / No visible brand',
                'Other',
                'Not sure'
            ],
            'allow_detail': True,
            'detail_placeholder': 'Brand name or printed logo'
        },
        {
            'key': 'distinguishing_feature',
            'label': 'Sticker, Dent, or Distinguishing Mark',
            'type': 'choice',
            'options': [
                'Sticker(s) attached on body (club, quote, cartoon, etc.)',
                'Dent on base or side from dropping',
                'Name or initials written in marker / etched',
                'Handle / loop strap on cap',
                'Straw nozzle or flip lid mechanism',
                'Scratches or peeling paint on coating',
                'None / Clean condition',
                'Other',
                'Not sure'
            ],
            'allow_detail': True,
            'detail_placeholder': 'Describe sticker, dent location, or lid color'
        }
    ],

    'Electronics': [
        {
            'key': 'device_type',
            'label': 'Type of Electronic Device',
            'type': 'choice',
            'options': [
                'Wireless Earbuds / Case (AirPods, Galaxy Buds, boAt)',
                'Over-ear Headphones',
                'Tablet / iPad / Drawing Pad',
                'Smartwatch / Fitness Band',
                'Power Bank / Portable Charger',
                'Scientific Calculator (Casio, TI)',
                'USB Flash Drive / Hard Drive',
                'Laptop Charger / Phone Adapter & Cable',
                'Other',
                'Not sure'
            ],
            'allow_detail': True,
            'detail_placeholder': 'Exact device type'
        },
        {
            'key': 'brand',
            'label': 'Brand / Manufacturer',
            'type': 'choice',
            'options': [
                'Apple',
                'Samsung',
                'boAt / Noise / Boult',
                'Sony / JBL / Bose',
                'Casio',
                'Mi / Xiaomi',
                'Realme',
                'Anker / Ambrane',
                'SanDisk',
                'Other',
                'Not sure'
            ],
            'allow_detail': True,
            'detail_placeholder': 'Brand name'
        },
        {
            'key': 'main_color',
            'label': 'Color',
            'type': 'choice',
            'options': [
                'White',
                'Black',
                'Grey / Silver',
                'Navy / Blue',
                'Red',
                'Pink / Rose',
                'Green',
                'Other',
                'Not sure'
            ],
            'allow_detail': True,
            'detail_placeholder': 'Color details'
        },
        {
            'key': 'distinguishing_feature',
            'label': 'Case, Strap, or Distinctive Mark',
            'type': 'choice',
            'options': [
                'Protective silicone sleeve on case',
                'Sticker or drawing on surface',
                'Silicone / Metal sport band (for watch)',
                'Scratch, dent, or scuff mark',
                'Keychain / carabiner clip attached',
                'Missing one earbud or piece',
                'None / Plain condition',
                'Other',
                'Not sure'
            ],
            'allow_detail': True,
            'detail_placeholder': 'Describe case, sticker, or distinctive detail'
        }
    ],

    'Stationery & Books': [
        {
            'key': 'item_type',
            'label': 'Type of Stationery / Book',
            'type': 'choice',
            'options': [
                'Subject Notebook / Register / Spiral Pad',
                'Course Textbook',
                'Scientific Calculator',
                'Pen / Pencil Pouch with instruments',
                'Document Folder / Project File',
                'Geometry / Drawing Instrument Box',
                'Laboratory Journal / Record Book',
                'Other',
                'Not sure'
            ],
            'allow_detail': True,
            'detail_placeholder': 'Subject name or title'
        },
        {
            'key': 'main_color',
            'label': 'Cover / Pouch Color',
            'type': 'choice',
            'options': [
                'Black / Dark cover',
                'Blue cover',
                'Red / Maroon cover',
                'Green cover',
                'Yellow / Orange cover',
                'Printed / Graphic cover',
                'Transparent / Clear folder',
                'Other',
                'Not sure'
            ],
            'allow_detail': True,
            'detail_placeholder': 'Cover design or color'
        },
        {
            'key': 'name_written',
            'label': 'Name or Roll Number Written on Item',
            'type': 'choice',
            'options': [
                'Yes, name / roll number on front cover label',
                'Yes, name written on inside first page',
                'Yes, name written on back or spine',
                'No name or student identifier written',
                'Other',
                'Not sure'
            ],
            'allow_detail': True,
            'detail_placeholder': 'Name as written on the item'
        },
        {
            'key': 'distinguishing_mark',
            'label': 'Subject, Title, or Distinctive Detail',
            'type': 'choice',
            'options': [
                'Engineering / Math / Science subject notes',
                'Management / Humanities subject notes',
                'Stickers on cover or pouch',
                'Sticky notes / index bookmarks inside',
                'Hardcover binding',
                'Spiral bound register',
                'Other',
                'Not sure'
            ],
            'allow_detail': True,
            'detail_placeholder': 'Subject, semester, or teacher name mentioned'
        }
    ],

    'Clothing & Accessories': [
        {
            'key': 'apparel_type',
            'label': 'Type of Apparel / Accessory',
            'type': 'choice',
            'options': [
                'Jacket / Windbreaker / Coat',
                'Hoodie / Sweatshirt',
                'Cardigan / Sweater',
                'Cap / Beanie / Hat',
                'Scarf / Muffler / Stole',
                'Eyeglasses / Sunglasses in case',
                'Umbrella',
                'Wristwatch',
                'Belt',
                'Other',
                'Not sure'
            ],
            'allow_detail': True,
            'detail_placeholder': 'Apparel item type'
        },
        {
            'key': 'main_color',
            'label': 'Primary Color & Pattern',
            'type': 'choice',
            'options': [
                'Solid Black',
                'Solid Navy / Blue',
                'Grey / Charcoal',
                'Olive / Army Green',
                'Maroon / Red',
                'Beige / White / Cream',
                'Striped / Checked pattern',
                'Printed / Graphic pattern',
                'Other',
                'Not sure'
            ],
            'allow_detail': True,
            'detail_placeholder': 'Color or pattern details'
        },
        {
            'key': 'brand',
            'label': 'Brand (if visible on tag or front)',
            'type': 'choice',
            'options': [
                'Nike / Adidas / Puma',
                'H&M / Zara',
                'Decathlon / Quechua',
                'Levi’s / Wrangler',
                'College / Department branded merchandise',
                'Generic / No prominent brand',
                'Other',
                'Not sure'
            ],
            'allow_detail': True,
            'detail_placeholder': 'Brand name'
        },
        {
            'key': 'distinguishing_mark',
            'label': 'Size, Hood, Zipper, or Distinctive Mark',
            'type': 'choice',
            'options': [
                'Has hood and front kangaroo pocket',
                'Full front zip',
                'College department or club embroidery',
                'Pin or badge on lapel / chest',
                'Name / initials written on inner tag',
                'Patch, tear, or missing button',
                'None / Plain style',
                'Other',
                'Not sure'
            ],
            'allow_detail': True,
            'detail_placeholder': 'Size tag or distinctive detail'
        }
    ],

    'Jewellery & Watches': [
        {
            'key': 'item_type',
            'label': 'Item Type',
            'type': 'choice',
            'options': [
                'Wristwatch (Analog)',
                'Smartwatch / Fitness tracker',
                'Ring (Finger ring / Band)',
                'Bracelet / Bangle / Kada',
                'Chain / Necklace / Pendant',
                'Earrings / Studs',
                'Other',
                'Not sure'
            ],
            'allow_detail': True,
            'detail_placeholder': 'Item description'
        },
        {
            'key': 'metal_color',
            'label': 'Metal Tone / Main Color',
            'type': 'choice',
            'options': [
                'Silver / Steel tone',
                'Gold tone / Yellow gold',
                'Rose Gold',
                'Black metal / Matte black',
                'Leather strap (black/brown)',
                'Beaded / Thread / Fabric cord',
                'Other',
                'Not sure'
            ],
            'allow_detail': True,
            'detail_placeholder': 'Tone or strap color'
        },
        {
            'key': 'brand_style',
            'label': 'Brand / Design Style',
            'type': 'choice',
            'options': [
                'Casio / Fastrack / Titan / Timex',
                'Fossil / Tommy Hilfiger',
                'Apple / Samsung / Noise watch',
                'Traditional / Religious design',
                'Minimalist plain band',
                'Stone / Crystal embedded',
                'Other',
                'Not sure'
            ],
            'allow_detail': True,
            'detail_placeholder': 'Brand or design pattern'
        },
        {
            'key': 'distinguishing_mark',
            'label': 'Engraving, Scratch, or Distinctive Detail',
            'type': 'choice',
            'options': [
                'Initials or date engraved inside / on back',
                'Distinctive dial color or patterned face',
                'Scratch on watch glass / metal surface',
                'Unique clasp or magnetic lock',
                'Small gemstone or pearl',
                'None / Plain surface',
                'Other',
                'Not sure'
            ],
            'allow_detail': True,
            'detail_placeholder': 'Engraved text or scratch location'
        }
    ],

    'Sports & Fitness': [
        {
            'key': 'equipment_type',
            'label': 'Type of Sports Equipment',
            'type': 'choice',
            'options': [
                'Badminton / Tennis Racket & Cover',
                'Football / Basketball / Volleyball',
                'Cricket Bat / Kit piece',
                'Gym shaker / Protein bottle',
                'Yoga Mat / Exercise mat in carry bag',
                'Sports shoes / Cleats',
                'Gym gloves / Wrist wraps / Resistance band',
                'Swimming goggles / Cap',
                'Other',
                'Not sure'
            ],
            'allow_detail': True,
            'detail_placeholder': 'Specific equipment type'
        },
        {
            'key': 'main_color',
            'label': 'Main Color',
            'type': 'choice',
            'options': [
                'Black',
                'Blue / Navy',
                'Red',
                'Neon Green / Yellow',
                'White',
                'Multi-colored',
                'Other',
                'Not sure'
            ],
            'allow_detail': True,
            'detail_placeholder': 'Color description'
        },
        {
            'key': 'brand',
            'label': 'Brand',
            'type': 'choice',
            'options': [
                'Yonex / Li-Ning',
                'Nivia / Cosco',
                'Decathlon / Artengo / Kipsta',
                'Nike / Adidas / Puma',
                'Wilson / Head',
                'Generic / No brand',
                'Other',
                'Not sure'
            ],
            'allow_detail': True,
            'detail_placeholder': 'Brand name'
        },
        {
            'key': 'distinguishing_mark',
            'label': 'Grip Color, Cover, or Distinctive Mark',
            'type': 'choice',
            'options': [
                'Grip tape color on handle (black, red, neon, etc.)',
                'Stored inside zipped branded cover bag',
                'Name / initials written in marker',
                'Scuff marks / paint chipped on frame',
                'None / Plain condition',
                'Other',
                'Not sure'
            ],
            'allow_detail': True,
            'detail_placeholder': 'Grip color or initials'
        }
    ],

    'Documents & ID': [
        {
            'key': 'document_type',
            'label': 'Document Type',
            'type': 'choice',
            'options': [
                'College Student ID Card',
                'National ID / Aadhaar Card',
                'Driver’s License',
                'Passport',
                'Academic Marksheet / Degree Certificate',
                'Bank Passbook / Chequebook',
                'Hall Ticket / Exam Admit Card',
                'Folder containing multiple official papers',
                'Other',
                'Not sure'
            ],
            'allow_detail': True,
            'detail_placeholder': 'Document category'
        },
        {
            'key': 'holder_color',
            'label': 'Lanyard, Folder, or Cover Color',
            'type': 'choice',
            'options': [
                'College neck lanyard attached',
                'Transparent plastic card sleeve',
                'Blue folder / envelope',
                'Yellow / Brown document envelope',
                'Clear file folder with pockets',
                'No cover / Loose card',
                'Other',
                'Not sure'
            ],
            'allow_detail': True,
            'detail_placeholder': 'Folder or holder color'
        },
        {
            'key': 'name_on_doc',
            'label': 'Name on Document',
            'type': 'choice',
            'options': [
                'Yes, my name is printed clearly on it',
                'Yes, contains passport photo of owner',
                'Document has handwritten student details',
                'Other',
                'Not sure'
            ],
            'allow_detail': True,
            'detail_placeholder': 'Full name printed on document (helps verify ownership)'
        },
        {
            'key': 'distinguishing_mark',
            'label': 'Department, Year, or Distinctive Mark',
            'type': 'choice',
            'options': [
                'Department / branch printed on ID card',
                'Current academic year / semester indicated',
                'Hologram or official college seal present',
                'Sticker, tape, or lamination on card',
                'Other',
                'Not sure'
            ],
            'allow_detail': True,
            'detail_placeholder': 'Department or graduation year'
        }
    ],

    'Other': [
        {
            'key': 'item_nature',
            'label': 'What kind of item is this?',
            'type': 'choice',
            'options': [
                'Personal accessory / Eyewear',
                'Academic or project material',
                'Musical instrument / Audio gear',
                'Medical item (inhaler, glasses case, medicines)',
                'Tools / Hardware',
                'Umbrella / Rain gear',
                'Miscellaneous campus item',
                'Other',
                'Not sure'
            ],
            'allow_detail': True,
            'detail_placeholder': 'Briefly classify what the item is'
        },
        {
            'key': 'main_color',
            'label': 'Primary Visible Color',
            'type': 'choice',
            'options': [
                'Black',
                'White / Cream',
                'Blue / Navy',
                'Red / Maroon',
                'Green / Olive',
                'Grey / Silver',
                'Brown / Tan',
                'Multi-colored',
                'Other',
                'Not sure'
            ],
            'allow_detail': True,
            'detail_placeholder': 'Color details'
        },
        {
            'key': 'brand_material',
            'label': 'Brand or Material',
            'type': 'choice',
            'options': [
                'Plastic / Polymer',
                'Metal / Alloy',
                'Fabric / Cloth',
                'Leather / Faux-leather',
                'Wood / Bamboo',
                'Glass / Ceramic',
                'Other',
                'Not sure'
            ],
            'allow_detail': True,
            'detail_placeholder': 'Brand name or material'
        },
        {
            'key': 'distinguishing_mark',
            'label': 'Any Sticker, Scratch, or Distinctive Mark',
            'type': 'choice',
            'options': [
                'Name, initials, or handwriting visible',
                'Sticker, tape, or label attached',
                'Scratch, crack, or dent from usage',
                'Pouch, sleeve, or case included',
                'None / Plain condition',
                'Other',
                'Not sure'
            ],
            'allow_detail': True,
            'detail_placeholder': 'Describe any distinctive mark'
        }
    ]
}

# Category name normalization map (aliases to canonical key in CATEGORY_QUESTION_BANK)
CATEGORY_ALIASES: Dict[str, str] = {
    'phone': 'Phone',
    'smartphone': 'Phone',
    'mobile': 'Phone',
    'cellphone': 'Phone',
    'iphone': 'Phone',
    'laptop': 'Laptop',
    'notebook': 'Laptop',
    'macbook': 'Laptop',
    'computer': 'Laptop',
    'backpack': 'Backpack & Bags',
    'backpacks': 'Backpack & Bags',
    'bag': 'Backpack & Bags',
    'bags': 'Backpack & Bags',
    'bags & luggage': 'Backpack & Bags',
    'backpack & bags': 'Backpack & Bags',
    'wallet': 'Wallet & Cards',
    'wallets': 'Wallet & Cards',
    'purse': 'Wallet & Cards',
    'wallet & cards': 'Wallet & Cards',
    'cards': 'Wallet & Cards',
    'key': 'Keys & Badges',
    'keys': 'Keys & Badges',
    'keys & badges': 'Keys & Badges',
    'keychain': 'Keys & Badges',
    'badge': 'Keys & Badges',
    'bottle': 'Bottles & Containers',
    'bottles': 'Bottles & Containers',
    'bottles & containers': 'Bottles & Containers',
    'water bottle': 'Bottles & Containers',
    'flask': 'Bottles & Containers',
    'electronics': 'Electronics',
    'other electronics': 'Electronics',
    'gadget': 'Electronics',
    'stationery': 'Stationery & Books',
    'stationery & books': 'Stationery & Books',
    'book': 'Stationery & Books',
    'books': 'Stationery & Books',
    'clothing': 'Clothing & Accessories',
    'clothing & accessories': 'Clothing & Accessories',
    'clothes': 'Clothing & Accessories',
    'apparel': 'Clothing & Accessories',
    'jewellery': 'Jewellery & Watches',
    'jewellery & watches': 'Jewellery & Watches',
    'jewelry': 'Jewellery & Watches',
    'watch': 'Jewellery & Watches',
    'sports': 'Sports & Fitness',
    'sports & fitness': 'Sports & Fitness',
    'fitness': 'Sports & Fitness',
    'gym': 'Sports & Fitness',
    'documents': 'Documents & ID',
    'documents & id': 'Documents & ID',
    'document': 'Documents & ID',
    'id': 'Documents & ID',
    'id card': 'Documents & ID',
    'other': 'Other',
    'general': 'Other',
}

def resolve_category_key(category_name: str) -> str:
    """Resolves a category string (case-insensitive) to its canonical key."""
    if not category_name:
        return 'Other'
    normalized = category_name.strip().lower()
    if normalized in CATEGORY_ALIASES:
        return CATEGORY_ALIASES[normalized]
    # Check substring containment
    for alias, canonical in CATEGORY_ALIASES.items():
        if alias in normalized or normalized in alias:
            return canonical
    return 'Other'

def get_category_questions(category_name: str) -> List[Dict[str, Any]]:
    """Returns 3–4 tailored MCQs for the given category."""
    canonical_key = resolve_category_key(category_name)
    return CATEGORY_QUESTION_BANK.get(canonical_key, CATEGORY_QUESTION_BANK['Other'])

def get_all_category_question_banks() -> Dict[str, Any]:
    """Returns full catalog of categories and questions for frontend client."""
    return {
        'version': QUESTION_BANK_VERSION,
        'categories': list(CATEGORY_QUESTION_BANK.keys()),
        'questions': CATEGORY_QUESTION_BANK,
    }

def build_question_snapshot(
    category_name: str,
    submitted_answers: Dict[str, Any],
    location_details: Optional[Dict[str, Any]] = None
) -> Dict[str, Any]:
    """
    Constructs an immutable snapshot containing question definitions, version,
    and submitted answers. This structure is persisted in LostItem.original_answers
    to preserve historical fidelity.
    """
    canonical_key = resolve_category_key(category_name)
    questions = get_category_questions(canonical_key)

    snapshot_questions = []
    clean_answers = {}

    for q in questions:
        key = q['key']
        user_val = submitted_answers.get(key)
        detail_val = submitted_answers.get(f"{key}_detail", "")
        if user_val:
            clean_answers[key] = user_val
            if detail_val:
                clean_answers[f"{key}_detail"] = detail_val

        snapshot_questions.append({
            'key': key,
            'label': q['label'],
            'options': q['options'],
            'selected': user_val or None,
            'detail': detail_val or None,
        })

    snapshot = {
        'version': QUESTION_BANK_VERSION,
        'category': canonical_key,
        'questions': snapshot_questions,
        'answers': clean_answers,
    }

    if location_details:
        for k in ['lost_location', 'lost_date', 'lost_time']:
            if location_details.get(k):
                snapshot[k] = location_details[k]

    return snapshot

def extract_normalized_attributes(
    category_name: str,
    submitted_answers: Dict[str, Any]
) -> Dict[str, str]:
    """
    Extracts high-signal normalized attributes for item matching algorithm.
    Excludes uncertain answers ('Not sure', 'None', etc.).
    """
    canonical_key = resolve_category_key(category_name)
    questions = get_category_questions(canonical_key)
    attrs = {}

    for q in questions:
        key = q['key']
        val = submitted_answers.get(key)
        detail = submitted_answers.get(f"{key}_detail")
        if val and isinstance(val, str) and val.strip():
            v_clean = val.strip()
            if v_clean.lower() not in ('not sure', 'unknown', 'none / clean condition', 'none / plain style', 'none'):
                if v_clean == 'Other' and detail:
                    attrs[key] = detail.strip()
                else:
                    attrs[key] = f"{v_clean} ({detail.strip()})" if detail else v_clean

    return attrs
