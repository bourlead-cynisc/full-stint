const KMH_FACTOR = 20;

const GT3_CATALOG = [
    {
        id: 'aston_gt3', carClass: 'GT3', drivetrain: 'RWD', engineLayout: 'FR', driveTraction: 0.98, driveRotation: 0.97,
        name: 'Aston Martin Vantage GT3', shortName: 'Aston Vantage',
        teamName: 'Heart of Racing / AMR',
        width: 22, height: 45, topSpeedKmh: 252, accelStat: 1.01, handlingStat: 1.06, tireSaveStat: 1.08,
        livery: { primary: '#1e3f35', secondary: '#141b1f', accent: '#a3e635', wing: '#11161b' },
        drivers: [
            { name: 'M. Sørensen', number: 27, tier: 'PRO ★', skill: 1.012, cornerMult: 1.03, aggression: 0.85 },
            { name: 'I. James',    number: 777, tier: 'MID',   skill: 0.978, cornerMult: 0.99, aggression: 0.65 }
        ]
    },
    {
        id: 'audi_gt3', carClass: 'GT3', drivetrain: 'RWD', engineLayout: 'MR', driveTraction: 1.08, driveRotation: 1.06,
        name: 'Audi R8 LMS GT3 Evo II', shortName: 'Audi R8 LMS',
        teamName: 'Audi Sport Team WRT',
        width: 22, height: 44, topSpeedKmh: 254, accelStat: 1.04, handlingStat: 1.05, tireSaveStat: 0.99,
        livery: { primary: '#d1d5db', secondary: '#dc2626', accent: '#111827', wing: '#18181b' },
        drivers: [
            { name: 'K. van der Linde', number: 32, tier: 'PRO ★', skill: 1.014, cornerMult: 1.04, aggression: 0.88 },
            { name: 'C. Haase',         number: 25, tier: 'PRO',   skill: 0.995, cornerMult: 1.01, aggression: 0.74 }
        ]
    },
    {
        id: 'bmw_gt3', carClass: 'GT3', drivetrain: 'RWD', engineLayout: 'FR', driveTraction: 1, driveRotation: 0.98,
        name: 'BMW M4 GT3', shortName: 'BMW M4 GT3',
        teamName: 'Team WRT BMW M',
        width: 22, height: 46, topSpeedKmh: 255, accelStat: 1.02, handlingStat: 1.01, tireSaveStat: 1.05,
        livery: { primary: '#1d4ed8', secondary: '#ef4444', accent: '#38bdf8', wing: '#111827' },
        drivers: [
            { name: 'V. Rossi',  number: 46, tier: 'PRO ★', skill: 1.008, cornerMult: 1.02, aggression: 0.86 },
            { name: 'A. Farfus', number: 31, tier: 'PRO',   skill: 0.998, cornerMult: 1.01, aggression: 0.78 }
        ]
    },
    {
        id: 'corvette_gt3', carClass: 'GT3', drivetrain: 'RWD', engineLayout: 'MR', driveTraction: 1.07, driveRotation: 1.04,
        name: 'Corvette Z06 GT3.R', shortName: 'Corvette Z06',
        teamName: 'TF Sport Corvette Racing',
        width: 22.5, height: 45, topSpeedKmh: 255, accelStat: 1.05, handlingStat: 1.02, tireSaveStat: 0.97,
        livery: { primary: '#facc15', secondary: '#18181b', accent: '#dc2626', wing: '#111827' },
        drivers: [
            { name: 'N. Catsburg', number: 81, tier: 'PRO', skill: 1.002, cornerMult: 1.01, aggression: 0.82 },
            { name: 'C. Eastwood', number: 82, tier: 'MID', skill: 0.985, cornerMult: 0.99, aggression: 0.72 }
        ]
    },
    {
        id: 'ferrari_gt3', carClass: 'GT3', drivetrain: 'RWD', engineLayout: 'MR', driveTraction: 1.09, driveRotation: 1.07,
        name: 'Ferrari 296 GT3', shortName: 'Ferrari 296',
        teamName: 'Vista AF Corse Ferrari',
        width: 22, height: 44.5, topSpeedKmh: 254, accelStat: 1.05, handlingStat: 1.08, tireSaveStat: 1.02,
        livery: { primary: '#dc2626', secondary: '#f8fafc', accent: '#facc15', wing: '#18181b' },
        drivers: [
            { name: 'A. Pier Guidi', number: 51, tier: 'PRO ★', skill: 1.018, cornerMult: 1.05, aggression: 0.90 },
            { name: 'D. Rigon',      number: 54, tier: 'PRO',   skill: 1.000, cornerMult: 1.02, aggression: 0.79 }
        ]
    },
    {
        id: 'mustang_gt3', carClass: 'GT3', drivetrain: 'RWD', engineLayout: 'FR', driveTraction: 0.98, driveRotation: 0.95,
        name: 'Ford Mustang GT3', shortName: 'Mustang GT3',
        teamName: 'Proton Competition Ford',
        width: 22.5, height: 46, topSpeedKmh: 256, accelStat: 1.04, handlingStat: 0.98, tireSaveStat: 1.01,
        livery: { primary: '#172554', secondary: '#f8fafc', accent: '#3b82f6', wing: '#0f172a' },
        drivers: [
            { name: 'D. Olsen', number: 88, tier: 'PRO', skill: 0.994, cornerMult: 1.00, aggression: 0.80 },
            { name: 'C. Mies',  number: 77, tier: 'MID', skill: 0.982, cornerMult: 0.98, aggression: 0.74 }
        ]
    },
    {
        id: 'lambo_gt3', carClass: 'GT3', drivetrain: 'RWD', engineLayout: 'MR', driveTraction: 1.07, driveRotation: 1.05,
        name: 'Lamborghini Huracán GT3', shortName: 'Huracán GT3',
        teamName: 'Iron Lynx Lamborghini',
        width: 22, height: 44.5, topSpeedKmh: 255, accelStat: 1.06, handlingStat: 1.03, tireSaveStat: 0.95,
        livery: { primary: '#4ade80', secondary: '#18181b', accent: '#22c55e', wing: '#111827' },
        drivers: [
            { name: 'M. Bortolotti', number: 63, tier: 'PRO ★', skill: 1.015, cornerMult: 1.04, aggression: 0.89 },
            { name: 'E. Mortara',    number: 19, tier: 'PRO',   skill: 0.997, cornerMult: 1.01, aggression: 0.81 }
        ]
    },
    {
        id: 'lexus_gt3', carClass: 'GT3', drivetrain: 'RWD', engineLayout: 'FR', driveTraction: 0.99, driveRotation: 0.97,
        name: 'Lexus RC F GT3', shortName: 'Lexus RC F',
        teamName: 'Akkodis ASP Team Lexus',
        width: 22, height: 46, topSpeedKmh: 253, accelStat: 1.00, handlingStat: 1.00, tireSaveStat: 1.06,
        livery: { primary: '#1e293b', secondary: '#f97316', accent: '#0f172a', wing: '#111827' },
        drivers: [
            { name: 'J. M. López', number: 87, tier: 'PRO',   skill: 0.992, cornerMult: 1.00, aggression: 0.77 },
            { name: 'K. Miyata',   number: 78, tier: 'ROOKIE', skill: 0.968, cornerMult: 0.97, aggression: 0.68 }
        ]
    },
    {
        id: 'mclaren_gt3', carClass: 'GT3', drivetrain: 'RWD', engineLayout: 'MR', driveTraction: 1.08, driveRotation: 1.06,
        name: 'McLaren 720S GT3', shortName: 'McLaren 720S',
        teamName: 'United Autosports McLaren',
        width: 22, height: 44.5, topSpeedKmh: 254, accelStat: 1.05, handlingStat: 1.07, tireSaveStat: 0.98,
        livery: { primary: '#f97316', secondary: '#1c1917', accent: '#fb923c', wing: '#111827' },
        drivers: [
            { name: 'O. Jarvis', number: 59, tier: 'PRO', skill: 1.001, cornerMult: 1.02, aggression: 0.80 },
            { name: 'M. Sato',   number: 95, tier: 'MID', skill: 0.974, cornerMult: 0.98, aggression: 0.70 }
        ]
    },
    {
        id: 'mercedes_gt3', carClass: 'GT3', drivetrain: 'RWD', engineLayout: 'FR', driveTraction: 1, driveRotation: 0.98,
        name: 'Mercedes-AMG GT3', shortName: 'AMG GT3',
        teamName: 'Mercedes-AMG Team Mann-Filter',
        width: 22.5, height: 45.5, topSpeedKmh: 253, accelStat: 1.01, handlingStat: 1.04, tireSaveStat: 1.07,
        livery: { primary: '#64748b', secondary: '#facc15', accent: '#1e293b', wing: '#0f172a' },
        drivers: [
            { name: 'L. Stolz', number: 4, tier: 'PRO ★', skill: 1.011, cornerMult: 1.03, aggression: 0.84 }
        ]
    },
    {
        id: 'porsche_gt3', carClass: 'GT3', drivetrain: 'RWD', engineLayout: 'RR', driveTraction: 1.1, driveRotation: 1.02,
        name: 'Porsche 911 GT3 R (992)', shortName: 'Porsche 911',
        teamName: 'Manthey PureRxcing Porsche',
        width: 22, height: 44, topSpeedKmh: 251, accelStat: 1.03, handlingStat: 1.10, tireSaveStat: 1.11,
        livery: { primary: '#f8fafc', secondary: '#ec4899', accent: '#06b6d4', wing: '#18181b' },
        drivers: [
            { name: 'K. Estre',    number: 92, tier: 'PRO ★', skill: 1.020, cornerMult: 1.06, aggression: 0.92 }
        ]
    },
    {
        id: 'bentley_gt3', carClass: 'GT3', drivetrain: 'RWD', engineLayout: 'FR', driveTraction: 0.99, driveRotation: 0.96,
        name: 'Bentley Continental GT3', shortName: 'Bentley GT3',
        teamName: 'M-Sport Bentley Team',
        width: 23, height: 46.5, topSpeedKmh: 255, accelStat: 1.02, handlingStat: 0.99, tireSaveStat: 1.05,
        livery: { primary: '#3f474e', secondary: '#22c55e', accent: '#18181b', wing: '#111827' },
        drivers: [
            { name: 'J. Gounon', number: 7, tier: 'PRO', skill: 0.999, cornerMult: 1.01, aggression: 0.83 }
        ]
    }
];


// Track-day vehicles are production road cars, not GT3/F1 homologations.
// Drivetrain layout is manufacturer-specified; tuning values below are gameplay balance.
const ROAD_CATALOG = [
    {
        id:'vw_golf_gti',carClass:'ROAD',drivetrain:'FWD',engineLayout:'FR',driveTraction:0.92,driveRotation:0.92,
        name:'Volkswagen Golf GTI',shortName:'Golf GTI',teamName:'Track Day · Volkswagen',
        width:22,height:41,topSpeedKmh:250,accelStat:0.87,handlingStat:1.01,tireSaveStat:1.04,
        gearFrac:[.28,.39,.50,.63,.76,.88,1],
        livery:{primary:'#ed243b',secondary:'#1b2430',accent:'#e6e6e6',wing:'#171b25'},
        drivers:[{name:'Тест-пилот GTI',number:50,tier:'TEST',skill:1,cornerMult:1,aggression:.72}]
    },
    {
        id:'audi_rs3_road',carClass:'ROAD',drivetrain:'AWD',engineLayout:'FR',driveTraction:1.12,driveRotation:0.98,
        name:'Audi RS 3 Sportback',shortName:'Audi RS 3',teamName:'Track Day · Audi',
        width:23,height:43,topSpeedKmh:250,accelStat:1.06,handlingStat:1.05,tireSaveStat:1,
        gearFrac:[.27,.38,.49,.61,.74,.87,1],
        livery:{primary:'#2f76e6',secondary:'#101720',accent:'#e9eef4',wing:'#101720'},
        drivers:[{name:'Тест-пилот RS3',number:33,tier:'TEST',skill:1,cornerMult:1,aggression:.72}]
    },
    {
        id:'porsche_911_road',carClass:'ROAD',drivetrain:'RWD',engineLayout:'RR',driveTraction:1.03,driveRotation:1.06,
        name:'Porsche 911 Carrera',shortName:'911 Carrera',teamName:'Track Day · Porsche',
        width:23,height:43,topSpeedKmh:295,accelStat:1.08,handlingStat:1.10,tireSaveStat:1.02,
        gearFrac:[.24,.34,.44,.55,.65,.76,.88,1],
        livery:{primary:'#e1e1de',secondary:'#22252a',accent:'#e7b968',wing:'#16171b'},
        drivers:[{name:'Тест-пилот 911',number:11,tier:'TEST',skill:1,cornerMult:1,aggression:.72}]
    }
];

const F1_CATALOG = [
    {
        id: 'f1_redbull', carClass: 'F1', drivetrain: 'RWD', engineLayout: 'MR', driveTraction: 1.04, driveRotation: 1.03,
        name: 'Red Bull Racing', shortName: 'Red Bull RB',
        teamName: 'Oracle Red Bull Racing',
        width: 21, height: 50, topSpeedKmh: 353, accelStat: 1.40, handlingStat: 1.38, tireSaveStat: 1.05,
        livery: { primary: '#17203d', secondary: '#dc2626', accent: '#facc15', wing: '#0f172a' },
        drivers: [
            { name: 'M. Verstappen', number: 1,  tier: 'PRO ★', skill: 1.022, cornerMult: 1.06, aggression: 0.95 },
            { name: 'I. Hadjar',     number: 6,  tier: 'PRO',   skill: 0.994, cornerMult: 1.01, aggression: 0.84 }
        ]
    },
    {
        id: 'f1_mercedes', carClass: 'F1', drivetrain: 'RWD', engineLayout: 'MR', driveTraction: 1.04, driveRotation: 1.03,
        name: 'Mercedes-AMG', shortName: 'Mercedes W16',
        teamName: 'Mercedes-AMG Petronas F1',
        width: 21, height: 50, topSpeedKmh: 350, accelStat: 1.38, handlingStat: 1.36, tireSaveStat: 1.04,
        livery: { primary: '#d1d5db', secondary: '#111827', accent: '#00d2be', wing: '#00d2be' },
        drivers: [
            { name: 'G. Russell',   number: 63, tier: 'PRO ★', skill: 1.014, cornerMult: 1.04, aggression: 0.88 },
            { name: 'K. Antonelli', number: 12, tier: 'PRO',   skill: 0.996, cornerMult: 1.02, aggression: 0.85 }
        ]
    },
    {
        id: 'f1_ferrari', carClass: 'F1', drivetrain: 'RWD', engineLayout: 'MR', driveTraction: 1.04, driveRotation: 1.03,
        name: 'Scuderia Ferrari', shortName: 'Ferrari SF',
        teamName: 'Scuderia Ferrari HP',
        width: 21, height: 50, topSpeedKmh: 352, accelStat: 1.40, handlingStat: 1.38, tireSaveStat: 1.03,
        livery: { primary: '#dc2626', secondary: '#111827', accent: '#facc15', wing: '#18181b' },
        drivers: [
            { name: 'C. Leclerc',  number: 16, tier: 'PRO ★', skill: 1.020, cornerMult: 1.05, aggression: 0.92 },
            { name: 'L. Hamilton', number: 44, tier: 'PRO ★', skill: 1.018, cornerMult: 1.05, aggression: 0.90 }
        ]
    },
    {
        id: 'f1_mclaren', carClass: 'F1', drivetrain: 'RWD', engineLayout: 'MR', driveTraction: 1.04, driveRotation: 1.03,
        name: 'McLaren Formula 1', shortName: 'McLaren MCL',
        teamName: 'McLaren Mastercard F1 Team',
        width: 21, height: 50, topSpeedKmh: 352, accelStat: 1.40, handlingStat: 1.39, tireSaveStat: 1.08,
        livery: { primary: '#f97316', secondary: '#18181b', accent: '#38bdf8', wing: '#f97316' },
        drivers: [
            { name: 'L. Norris',  number: 4,  tier: 'PRO ★', skill: 1.020, cornerMult: 1.05, aggression: 0.90 },
            { name: 'O. Piastri', number: 81, tier: 'PRO ★', skill: 1.017, cornerMult: 1.05, aggression: 0.89 }
        ]
    },
    {
        id: 'f1_aston', carClass: 'F1', drivetrain: 'RWD', engineLayout: 'MR', driveTraction: 1.04, driveRotation: 1.03,
        name: 'Aston Martin', shortName: 'Aston AMR',
        teamName: 'Aston Martin Aramco F1',
        width: 21, height: 50, topSpeedKmh: 348, accelStat: 1.36, handlingStat: 1.34, tireSaveStat: 1.06,
        livery: { primary: '#115e49', secondary: '#0f172a', accent: '#a3e635', wing: '#0f172a' },
        drivers: [
            { name: 'F. Alonso', number: 14, tier: 'PRO ★', skill: 1.012, cornerMult: 1.04, aggression: 0.91 },
            { name: 'L. Stroll', number: 18, tier: 'MID',   skill: 0.976, cornerMult: 0.98, aggression: 0.72 }
        ]
    },
    {
        id: 'f1_alpine', carClass: 'F1', drivetrain: 'RWD', engineLayout: 'MR', driveTraction: 1.04, driveRotation: 1.03,
        name: 'Alpine F1 Team', shortName: 'Alpine A526',
        teamName: 'BWT Alpine F1 Team',
        width: 21, height: 50, topSpeedKmh: 346, accelStat: 1.34, handlingStat: 1.32, tireSaveStat: 0.99,
        livery: { primary: '#0284c7', secondary: '#ec4899', accent: '#1e293b', wing: '#ec4899' },
        drivers: [
            { name: 'P. Gasly',     number: 10, tier: 'PRO', skill: 0.995, cornerMult: 1.01, aggression: 0.82 },
            { name: 'F. Colapinto', number: 43, tier: 'MID', skill: 0.982, cornerMult: 0.99, aggression: 0.79 }
        ]
    },
    {
        id: 'f1_sauber', carClass: 'F1', drivetrain: 'RWD', engineLayout: 'MR', driveTraction: 1.04, driveRotation: 1.03,
        name: 'Sauber / Audi', shortName: 'Sauber / Audi',
        teamName: 'Stake F1 Team Kick Audi',
        width: 21, height: 50, topSpeedKmh: 346, accelStat: 1.34, handlingStat: 1.31, tireSaveStat: 0.98,
        livery: { primary: '#22c55e', secondary: '#18181b', accent: '#4ade80', wing: '#22c55e' },
        drivers: [
            { name: 'N. Hülkenberg', number: 27, tier: 'PRO',    skill: 0.993, cornerMult: 1.01, aggression: 0.80 },
            { name: 'G. Bortoleto',  number: 5,  tier: 'ROOKIE', skill: 0.978, cornerMult: 0.99, aggression: 0.76 }
        ]
    },
    {
        id: 'f1_rb', carClass: 'F1', drivetrain: 'RWD', engineLayout: 'MR', driveTraction: 1.04, driveRotation: 1.03,
        name: 'Cash App RB', shortName: 'VCARB 02',
        teamName: 'Visa Cash App Racing Bulls',
        width: 21, height: 50, topSpeedKmh: 348, accelStat: 1.36, handlingStat: 1.33, tireSaveStat: 1.01,
        livery: { primary: '#1d4ed8', secondary: '#f8fafc', accent: '#ef4444', wing: '#f8fafc' },
        drivers: [
            { name: 'Y. Tsunoda', number: 22, tier: 'PRO', skill: 0.994, cornerMult: 1.01, aggression: 0.85 },
            { name: 'L. Lawson',  number: 30, tier: 'MID', skill: 0.988, cornerMult: 1.00, aggression: 0.83 }
        ]
    },
    {
        id: 'f1_williams', carClass: 'F1', drivetrain: 'RWD', engineLayout: 'MR', driveTraction: 1.04, driveRotation: 1.03,
        name: 'Williams Racing', shortName: 'Williams FW',
        teamName: 'Atlassian Williams Racing',
        width: 21, height: 50, topSpeedKmh: 351, accelStat: 1.37, handlingStat: 1.33, tireSaveStat: 1.00,
        livery: { primary: '#1e3a8a', secondary: '#0f172a', accent: '#facc15', wing: '#1e3a8a' },
        drivers: [
            { name: 'C. Sainz', number: 55, tier: 'PRO ★', skill: 1.009, cornerMult: 1.03, aggression: 0.87 },
            { name: 'A. Albon', number: 23, tier: 'PRO',   skill: 0.998, cornerMult: 1.01, aggression: 0.82 }
        ]
    },
    {
        id: 'f1_haas', carClass: 'F1', drivetrain: 'RWD', engineLayout: 'MR', driveTraction: 1.04, driveRotation: 1.03,
        name: 'Haas F1 Team', shortName: 'Haas VF',
        teamName: 'MoneyGram Haas F1 Team',
        width: 21, height: 50, topSpeedKmh: 347, accelStat: 1.35, handlingStat: 1.31, tireSaveStat: 0.98,
        livery: { primary: '#f8fafc', secondary: '#18181b', accent: '#dc2626', wing: '#dc2626' },
        drivers: [
            { name: 'E. Ocon',    number: 31, tier: 'PRO',    skill: 0.991, cornerMult: 1.00, aggression: 0.84 },
            { name: 'O. Bearman', number: 87, tier: 'ROOKIE', skill: 0.981, cornerMult: 0.99, aggression: 0.78 }
        ]
    },
    {
        id: 'f1_cadillac', carClass: 'F1', drivetrain: 'RWD', engineLayout: 'MR', driveTraction: 1.04, driveRotation: 1.03,
        name: 'Cadillac F1 Team', shortName: 'Cadillac F1',
        teamName: 'TWG Cadillac Formula 1 Team',
        width: 21, height: 50, topSpeedKmh: 347, accelStat: 1.35, handlingStat: 1.32, tireSaveStat: 0.99,
        livery: { primary: '#1e40af', secondary: '#f8fafc', accent: '#eab308', wing: '#1e3a8a' },
        drivers: [
            { name: 'S. Perez',  number: 11, tier: 'PRO', skill: 0.993, cornerMult: 1.00, aggression: 0.82 },
            { name: 'V. Bottas', number: 77, tier: 'PRO', skill: 0.989, cornerMult: 1.00, aggression: 0.77 }
        ]
    }
];

// ============================================================================
// БАЛАНС МАШИН (реалистичные величины)
//   power  — удельная мощность, Вт/кг
//   vmax   — максимальная скорость, км/ч (на высшей передаче у красной зоны)
//   grip   — механическое сцепление, g
//   aero   — добавка поперечного g от прижимной силы на vmax
//   brake  — тормозное замедление на малой скорости, g (+ добавка от прижима)
//   tire   — бережность к шинам (больше = износ медленнее)
// ============================================================================
const CAR_PERF = {
    // Track day: illustrative game physics values, not manufacturer telemetry.
    vw_golf_gti:{power:145,vmax:250,grip:1.16,aero:.12,brake:1.11,tire:1.08,note:'FWD: тяговое подруливание и недостаточная поворачиваемость под газом'},
    audi_rs3_road:{power:188,vmax:250,grip:1.23,aero:.18,brake:1.20,tire:1.00,note:'AWD: лучшая тяга со старта и на выходе'},
    porsche_911_road:{power:198,vmax:295,grip:1.27,aero:.25,brake:1.25,tire:1.03,note:'RWD: заднемоторная тяга, поворот под газом'},
    // ---- GT3 / WEC: балансировка по принципу BoP — у каждой машины свой характер ----
    aston_gt3:    { power: 300, vmax: 255, grip: 1.58, aero: 0.95, brake: 1.70, tire: 1.08, note: 'Универсал, бережёт шины' },
    audi_gt3:     { power: 310, vmax: 256, grip: 1.60, aero: 0.95, brake: 1.72, tire: 0.99, note: 'Стабильная и предсказуемая' },
    bmw_gt3:      { power: 316, vmax: 262, grip: 1.52, aero: 0.85, brake: 1.66, tire: 1.04, note: 'Быстрая на прямых' },
    corvette_gt3: { power: 324, vmax: 264, grip: 1.49, aero: 0.88, brake: 1.62, tire: 0.95, note: 'Мощная, но шины «горят»' },
    ferrari_gt3:  { power: 318, vmax: 260, grip: 1.63, aero: 1.00, brake: 1.78, tire: 1.00, note: 'Лучшая в поворотах' },
    mustang_gt3:  { power: 308, vmax: 258, grip: 1.52, aero: 0.85, brake: 1.66, tire: 1.03, note: 'Тяговитая, средняя в повороте' },
    lambo_gt3:    { power: 313, vmax: 258, grip: 1.64, aero: 1.00, brake: 1.74, tire: 0.93, note: 'Острый руль, быстрый износ' },
    lexus_gt3:    { power: 294, vmax: 250, grip: 1.50, aero: 0.85, brake: 1.66, tire: 1.12, note: 'Медленная, но берёт шины' },
    mclaren_gt3:  { power: 306, vmax: 254, grip: 1.60, aero: 1.18, brake: 1.74, tire: 0.97, note: 'Сильный прижим в быстрых' },
    mercedes_gt3: { power: 311, vmax: 258, grip: 1.57, aero: 1.00, brake: 1.72, tire: 1.00, note: 'Сбалансированная' },
    porsche_gt3:  { power: 292, vmax: 250, grip: 1.61, aero: 1.00, brake: 1.90, tire: 1.07, note: 'Лучшие тормоза, мало мощности' },
    bentley_gt3:  { power: 301, vmax: 252, grip: 1.47, aero: 0.84, brake: 1.62, tire: 1.13, note: 'Тяжёлая, но очень экономит шины' },
    // ---- Формула 1 ----
    f1_redbull:   { power: 930, vmax: 350, grip: 2.00, aero: 3.40, brake: 2.8, tire: 1.04, note: 'Эталон баланса' },
    f1_mercedes:  { power: 938, vmax: 348, grip: 2.00, aero: 3.35, brake: 2.8, tire: 1.06, note: 'Мягкая к шинам' },
    f1_ferrari:   { power: 944, vmax: 352, grip: 1.98, aero: 3.30, brake: 2.8, tire: 0.97, note: 'Самая мощная, шины страдают' },
    f1_mclaren:   { power: 925, vmax: 348, grip: 2.04, aero: 3.46, brake: 2.8, tire: 1.00, note: 'Лучший прижим' },
    f1_aston:     { power: 912, vmax: 345, grip: 1.95, aero: 3.20, brake: 2.7, tire: 1.00, note: 'Крепкий середняк' },
    f1_alpine:    { power: 905, vmax: 344, grip: 1.93, aero: 3.12, brake: 2.7, tire: 1.01, note: 'Ровная машина' },
    f1_sauber:    { power: 896, vmax: 343, grip: 1.92, aero: 3.10, brake: 2.7, tire: 1.02, note: 'Молодой проект' },
    f1_rb:        { power: 902, vmax: 343, grip: 1.94, aero: 3.15, brake: 2.7, tire: 0.99, note: 'Быстро разгоняется' },
    f1_williams:  { power: 906, vmax: 349, grip: 1.92, aero: 3.00, brake: 2.7, tire: 1.03, note: 'Низкое сопротивление воздуха' },
    f1_haas:      { power: 890, vmax: 342, grip: 1.90, aero: 3.05, brake: 2.65, tire: 0.98, note: 'Скромные ресурсы' },
    f1_cadillac:  { power: 882, vmax: 340, grip: 1.88, aero: 3.00, brake: 2.65, tire: 1.00, note: 'Новичок чемпионата' }
};
// Настройки по классам: обороты, передаточные отношения (доля vmax на красной зоне), время переключения
const CLASS_CFG = {
    ROAD:{redline:7000,idle:900,gearFrac:[.27,.39,.51,.64,.76,.88,1],upRpm:.95,shiftTime:.12,brakeAero:.28,rampers:'V6'},
    GT3: { redline: 7800,  idle: 1100, gearFrac: [0.30, 0.43, 0.57, 0.71, 0.85, 1.00],                     upRpm: 0.965, shiftTime: 0.09, brakeAero: 0.80, rampers: 'V8' },
    F1:  { redline: 15000, idle: 4500, gearFrac: [0.26, 0.35, 0.45, 0.55, 0.66, 0.77, 0.88, 1.00],         upRpm: 0.970, shiftTime: 0.04, brakeAero: 3.00, rampers: 'V6' }
};
for (const cat of [GT3_CATALOG, F1_CATALOG, ROAD_CATALOG]) {
    for (const spec of cat) {
        const p = CAR_PERF[spec.id];
        if (p) { spec.perf = p; spec.topSpeedKmh = Math.round(p.vmax); }
    }
}

const TIRE_COMPOUNDS = {
    soft:   { name: '🔴 SOFT',   label: 'Soft (мягкие)',   shortTag: '🔴 S', gripMult: 1.08, speedMult: 1.010, wearPerLap: 28, color: '#ff4757',
              info: 'Максимум сцепления. Стинт около 2–3 кругов.' },
    medium: { name: '🟡 MEDIUM', label: 'Medium (средние)', shortTag: '🟡 M', gripMult: 1.00, speedMult: 1.000, wearPerLap: 18, color: '#f1c40f',
              info: 'Ровный темп. Стинт около 4 кругов.' },
    hard:   { name: '⚪ HARD',   label: 'Hard (жёсткие)',  shortTag: '⚪ H', gripMult: 0.93, speedMult: 0.992, wearPerLap: 12, color: '#dfe4ea',
              info: 'Меньше сцепления. Стинт около 6 кругов.' }
};

// Условная потеря времени на пит-стопе (торможение + замена + разгон), в секундах.
const PIT_STOP_LOSS_SEC = 24;
// Шины с износом ниже этого порога резко теряют сцепление («клиф»).
const TIRE_CLIFF_PCT = 18;

// Очки Ф-1 за места 1–10
const F1_POINTS = [25, 18, 15, 12, 10, 8, 6, 4, 2, 1];
// Длительность гонки на выживание в классе WEC/GT3, минуты
const ENDURANCE_MINUTES = 20;

// Грубая оценка времени круга для планирования тактики в гонке на время (сек)
const EST_LAP_SEC = { GT3: [142, 140, 120, 152], F1: [112, 110, 92, 120], ROAD: [220, 215, 185, 235] };

// Планирование пит-стопов. arch: 'aggr' | 'bal' | 'eco'
function planStints(laps, arch) {
    const stints = [];
    let left = laps, k = 0;
    const first = { aggr: ['soft', 5], bal: ['medium', 8], eco: ['hard', 12] }[arch];
    const mid   = { aggr: ['medium', 8], bal: ['medium', 8], eco: ['hard', 12] }[arch];
    while (left > 0) {
        const [c, len] = (k === 0) ? first : mid;
        if (len >= left) {
            let comp = c;
            if (k > 0) comp = left <= 1 ? 'soft' : (left === 2 ? 'medium' : 'hard');
            stints.push([comp, left]);
            break;
        }
        stints.push([c, len]); left -= len; k++;
    }
    return stints;
}

// Разбивает стратегию на стинты и считает ожидаемое состояние шин в конце каждого.
function analyzeStrategy(laps, strat) {
    const stints = [];
    let from = 1, tire = strat.start;
    for (const s of strat.stops) {
        stints.push({ tire, fromLap: from, toLap: s.lap, laps: s.lap - from + 1 });
        from = s.lap + 1; tire = s.tire;
    }
    stints.push({ tire, fromLap: from, toLap: laps, laps: laps - from + 1 });
    for (const st of stints) {
        st.endHealth = Math.max(0, Math.round(100 - TIRE_COMPOUNDS[st.tire].wearPerLap * st.laps));
        st.cliff = st.endHealth <= TIRE_CLIFF_PCT;
    }
    return stints;
}

function getStrategyPresetsForLaps(laps) {
    const archs = [
        { key: 'aggr', name: 'Агрессивная: мягкие шины',
          idea: 'Soft на старте, короткие стинты ради максимального сцепления.',
          pros: 'Максимум сцепления и скорости на каждом круге. Хороша, когда трасса свободна и можно оторваться.',
          cons: 'Больше всего пит-стопов, каждый стоит ≈{loss} с. Мягкие шины требуют замены раньше остальных.' },
        { key: 'bal', name: 'Сбалансированная: Medium',
          idea: 'Medium: ровный темп, ориентир — 8 кругов на комплекте.',
          pros: 'Ровный темп, умеренное число пит-стопов, предсказуемое поведение машины.',
          cons: 'Нигде нет ни максимального сцепления, ни максимальной экономии. Medium к концу стинта уже на пределе.' },
        { key: 'eco', name: 'Экономная: жёсткие шины',
          idea: 'Hard: длинные стинты до 12 кругов, меньше остановок.',
          pros: 'Меньше всего пит-стопов (экономия времени), шины дольше держат стабильное сцепление.',
          cons: 'Hard самые медленные: в каждом повороте приходится ехать осторожнее. К концу 12-го круга износ почти на пределе.' }
    ];
    return archs.map(a => {
        const stintsRaw = planStints(laps, a.key);
        const stops = [];
        let lapCursor = 0;
        for (let i = 0; i < stintsRaw.length - 1; i++) {
            lapCursor += stintsRaw[i][1];
            stops.push({ lap: lapCursor, tire: stintsRaw[i + 1][0] });
        }
        const strat = { name: a.name, start: stintsRaw[0][0], stops };
        const an = analyzeStrategy(laps, strat);
        const worst = Math.min(...an.map(x => x.endHealth));
        const risk = worst <= 0 ? 'Высокий' : (worst <= TIRE_CLIFF_PCT ? 'Средний' : 'Низкий');
        const loss = PIT_STOP_LOSS_SEC;
        return Object.assign(strat, {
            risk,
            idea: a.idea,
            pros: a.pros.replace('{loss}', loss),
            cons: a.cons.replace('{loss}', loss),
            desc: a.idea
        });
    });
}

const TRACKS_DB = [
    {
        id: 'usa', name: '🇺🇸 США (Остин)', shortName: 'США (COTA)', desc: 'Подъем 41 м к Т1', scale: 66, pitSideSign: 1,
        theme: { grassBase: '#1b3b22', grassAlt: '#16301b', runoffColor: '#7c2d12' },
        evalElevation: function(norm) {
            return 41 * Math.exp(-Math.pow((norm - 0.085) / 0.042, 2)) + 10 * Math.sin(norm * Math.PI * 6);
        },
        drsZones: [{ detect: 0.43, start: 0.46, end: 0.56 }, { detect: 0.94, start: 0.97, end: 0.06 }],
        rawPoints: [
            {x: 93,  y: 185}, {x: 64,  y: 160}, {x: 36,  y: 137}, {x: 58,  y: 127},
            {x: 79,  y: 118}, {x: 91,  y: 136}, {x: 103, y: 151}, {x: 118, y: 154},
            {x: 133, y: 145}, {x: 138, y: 130}, {x: 128, y: 112}, {x: 121, y: 98},
            {x: 129, y: 95},  {x: 139, y: 109}, {x: 145, y: 121}, {x: 156, y: 120},
            {x: 159, y: 112}, {x: 148, y: 97},  {x: 138, y: 82},  {x: 185, y: 74},
            {x: 235, y: 65},  {x: 280, y: 56},  {x: 322, y: 47},  {x: 303, y: 72},
            {x: 285, y: 96},  {x: 268, y: 99},  {x: 253, y: 102}, {x: 242, y: 92},
            {x: 231, y: 104}, {x: 221, y: 113}, {x: 204, y: 104}, {x: 190, y: 109},
            {x: 182, y: 126}, {x: 170, y: 134}, {x: 162, y: 149}, {x: 146, y: 160},
            {x: 130, y: 172}, {x: 127, y: 186}, {x: 135, y: 214}, {x: 114, y: 199}
        ]
    },
    {
        id: 'baku', name: '🇦🇿 Баку', shortName: 'Баку', desc: 'Узкий старый город и бульвар', scale: 78, pitSideSign: -1,
        theme: { grassBase: '#1e293b', grassAlt: '#172030', runoffColor: '#0284c7' },
        evalElevation: function(norm) { return Math.max(0, 28 * Math.exp(-Math.pow((norm - 0.54) / 0.11, 2))); },
        drsZones: [{ detect: 0.08, start: 0.11, end: 0.19 }, { detect: 0.86, start: 0.89, end: 0.03 }],
        rawPoints: [
            {x: 255, y: 72},  {x: 288, y: 58},  {x: 278, y: 31},  {x: 270, y: 12},
            {x: 215, y: 34},  {x: 160, y: 56},  {x: 171, y: 84},  {x: 130, y: 102},
            {x: 134, y: 111}, {x: 112, y: 127}, {x: 91,  y: 144}, {x: 81,  y: 118},
            {x: 74,  y: 117}, {x: 68,  y: 116}, {x: 63,  y: 104}, {x: 38,  y: 117},
            {x: 15,  y: 130}, {x: 8,   y: 158}, {x: 9,   y: 188}, {x: 32,  y: 200},
            {x: 52,  y: 209}, {x: 66,  y: 184}, {x: 88,  y: 164}, {x: 94,  y: 147},
            {x: 136, y: 116}, {x: 180, y: 101}, {x: 222, y: 85}
        ]
    },
    {
        id: 'monza', name: '🇮🇹 Монца', shortName: 'Монца', desc: 'Храм скорости', scale: 77, pitSideSign: 1,
        theme: { grassBase: '#163820', grassAlt: '#112c19', runoffColor: '#15803d' },
        evalElevation: function(norm) { return 6 + 16 * Math.exp(-Math.pow((norm - 0.42) / 0.14, 2)); },
        drsZones: [{ detect: 0.51, start: 0.54, end: 0.66 }, { detect: 0.92, start: 0.95, end: 0.08 }],
        rawPoints: [
            {x: 205, y: 188}, {x: 155, y: 188}, {x: 110, y: 188}, {x: 105, y: 180},
            {x: 92,  y: 188}, {x: 64,  y: 188}, {x: 42,  y: 172}, {x: 32,  y: 138},
            {x: 25,  y: 95},  {x: 22,  y: 78},  {x: 16,  y: 72},  {x: 7,   y: 44},
            {x: 5,   y: 23},  {x: 22,  y: 13},  {x: 43,  y: 8},   {x: 66,  y: 42},
            {x: 84,  y: 66},  {x: 110, y: 94},  {x: 132, y: 116}, {x: 144, y: 114},
            {x: 156, y: 124}, {x: 205, y: 124}, {x: 252, y: 124}, {x: 282, y: 127},
            {x: 294, y: 148}, {x: 282, y: 175}, {x: 245, y: 186}
        ]
    },
    {
        id: 'spa', name: '🇧🇪 Спа-Франкоршам', shortName: 'Спа', desc: 'Eau Rouge / Raidillon', scale: 73, pitSideSign: 1,
        theme: { grassBase: '#133220', grassAlt: '#0e2618', runoffColor: '#b91c1c' },
        evalElevation: function(norm) {
            return Math.max(0, 15 - 14 * Math.exp(-Math.pow((norm - 0.12) / 0.03, 2)) + 68 * Math.exp(-Math.pow((norm - 0.30) / 0.15, 2)));
        },
        drsZones: [{ detect: 0.16, start: 0.20, end: 0.30 }, { detect: 0.94, start: 0.97, end: 0.04 }],
        rawPoints: [
            {x: 42,  y: 162}, {x: 22,  y: 177}, {x: 6,   y: 190}, {x: 15,  y: 162},
            {x: 42,  y: 128}, {x: 60,  y: 102}, {x: 78,  y: 94},  {x: 112, y: 66},
            {x: 162, y: 44},  {x: 212, y: 20},  {x: 230, y: 10},  {x: 242, y: 18},
            {x: 258, y: 12},  {x: 282, y: 40},  {x: 294, y: 60},  {x: 278, y: 66},
            {x: 262, y: 46},  {x: 222, y: 60},  {x: 194, y: 74},  {x: 192, y: 98},
            {x: 216, y: 116}, {x: 254, y: 132}, {x: 252, y: 156}, {x: 284, y: 178},
            {x: 274, y: 204}, {x: 242, y: 200}, {x: 208, y: 166}, {x: 190, y: 146},
            {x: 150, y: 130}, {x: 112, y: 146}, {x: 78,  y: 158}, {x: 72,  y: 144},
            {x: 56,  y: 152}
        ]
    }
];
// Авторские упрощённые схемы по мотивам автодромов; не геодезические копии.
TRACKS_DB.push({"id": "silverstone", "name": "🇬🇧 Сильверстоун", "shortName": "Сильверстоун", "desc": "Скоростные связки · упрощённая схема", "scale": 75, "pitSideSign": 1, "theme": {"grassBase": "#173c2c", "grassAlt": "#143425", "runoffColor": "#334155"}, "drsZones": [{"detect": 0.82, "start": 0.86, "end": 0.98}], "rawPoints": [{"x": 120, "y": 180}, {"x": 65, "y": 180}, {"x": 35, "y": 150}, {"x": 42, "y": 110}, {"x": 75, "y": 90}, {"x": 92, "y": 120}, {"x": 120, "y": 132}, {"x": 155, "y": 112}, {"x": 170, "y": 75}, {"x": 198, "y": 45}, {"x": 238, "y": 48}, {"x": 250, "y": 80}, {"x": 220, "y": 108}, {"x": 200, "y": 128}, {"x": 215, "y": 160}, {"x": 184, "y": 185}, {"x": 155, "y": 165}]});
EST_LAP_SEC.GT3.push(135); EST_LAP_SEC.F1.push(105);
TRACKS_DB.push({"id": "suzuka", "name": "🇯🇵 Судзука", "shortName": "Судзука", "desc": "Эски и шпилька · упрощённая схема", "scale": 75, "pitSideSign": 1, "theme": {"grassBase": "#173c2c", "grassAlt": "#143425", "runoffColor": "#334155"}, "drsZones": [{"detect": 0.82, "start": 0.86, "end": 0.98}], "rawPoints": [{"x": 90, "y": 180}, {"x": 45, "y": 180}, {"x": 25, "y": 160}, {"x": 30, "y": 130}, {"x": 55, "y": 115}, {"x": 42, "y": 95}, {"x": 68, "y": 78}, {"x": 85, "y": 98}, {"x": 108, "y": 70}, {"x": 140, "y": 45}, {"x": 180, "y": 30}, {"x": 220, "y": 45}, {"x": 225, "y": 70}, {"x": 190, "y": 88}, {"x": 148, "y": 115}, {"x": 120, "y": 138}, {"x": 130, "y": 160}, {"x": 110, "y": 165}]});
EST_LAP_SEC.GT3.push(140); EST_LAP_SEC.F1.push(109);
TRACKS_DB.push({"id": "bahrain", "name": "🇧🇭 Бахрейн", "shortName": "Бахрейн", "desc": "Торможения и разгон · упрощённая схема", "scale": 75, "pitSideSign": 1, "theme": {"grassBase": "#173c2c", "grassAlt": "#143425", "runoffColor": "#334155"}, "drsZones": [{"detect": 0.82, "start": 0.86, "end": 0.98}], "rawPoints": [{"x": 90, "y": 190}, {"x": 90, "y": 80}, {"x": 100, "y": 45}, {"x": 125, "y": 50}, {"x": 132, "y": 76}, {"x": 160, "y": 85}, {"x": 170, "y": 50}, {"x": 205, "y": 25}, {"x": 230, "y": 40}, {"x": 220, "y": 90}, {"x": 192, "y": 125}, {"x": 165, "y": 125}, {"x": 145, "y": 112}, {"x": 130, "y": 135}, {"x": 150, "y": 165}, {"x": 128, "y": 190}]});
EST_LAP_SEC.GT3.push(130); EST_LAP_SEC.F1.push(101);
TRACKS_DB.push({"id": "interlagos", "name": "🇧🇷 Интерлагос", "shortName": "Интерлагос", "desc": "Перепады ритма · упрощённая схема", "scale": 75, "pitSideSign": 1, "theme": {"grassBase": "#173c2c", "grassAlt": "#143425", "runoffColor": "#334155"}, "drsZones": [{"detect": 0.82, "start": 0.86, "end": 0.98}], "rawPoints": [{"x": 150, "y": 180}, {"x": 95, "y": 175}, {"x": 70, "y": 160}, {"x": 55, "y": 170}, {"x": 35, "y": 140}, {"x": 45, "y": 70}, {"x": 80, "y": 35}, {"x": 145, "y": 25}, {"x": 205, "y": 45}, {"x": 220, "y": 80}, {"x": 180, "y": 100}, {"x": 150, "y": 75}, {"x": 120, "y": 80}, {"x": 140, "y": 115}, {"x": 170, "y": 130}, {"x": 155, "y": 150}, {"x": 190, "y": 145}, {"x": 210, "y": 165}, {"x": 185, "y": 185}]});
EST_LAP_SEC.GT3.push(118); EST_LAP_SEC.F1.push(92);
TRACKS_DB.push({"id": "imola", "name": "🇮🇹 Имола", "shortName": "Имола", "desc": "Узкие связки · упрощённая схема", "scale": 75, "pitSideSign": 1, "theme": {"grassBase": "#173c2c", "grassAlt": "#143425", "runoffColor": "#334155"}, "drsZones": [{"detect": 0.82, "start": 0.86, "end": 0.98}], "rawPoints": [{"x": 90, "y": 180}, {"x": 50, "y": 150}, {"x": 35, "y": 115}, {"x": 50, "y": 100}, {"x": 42, "y": 80}, {"x": 80, "y": 40}, {"x": 120, "y": 25}, {"x": 150, "y": 45}, {"x": 160, "y": 75}, {"x": 180, "y": 65}, {"x": 205, "y": 85}, {"x": 195, "y": 115}, {"x": 165, "y": 125}, {"x": 150, "y": 145}, {"x": 165, "y": 170}, {"x": 140, "y": 195}, {"x": 110, "y": 200}]});
EST_LAP_SEC.GT3.push(130); EST_LAP_SEC.F1.push(101);
TRACKS_DB.push({"id": "barcelona", "name": "🇪🇸 Барселона", "shortName": "Барселона", "desc": "Баланс шасси · упрощённая схема", "scale": 75, "pitSideSign": 1, "theme": {"grassBase": "#173c2c", "grassAlt": "#143425", "runoffColor": "#334155"}, "drsZones": [{"detect": 0.82, "start": 0.86, "end": 0.98}], "rawPoints": [{"x": 100, "y": 190}, {"x": 100, "y": 85}, {"x": 120, "y": 50}, {"x": 145, "y": 65}, {"x": 160, "y": 100}, {"x": 195, "y": 110}, {"x": 220, "y": 90}, {"x": 225, "y": 50}, {"x": 245, "y": 40}, {"x": 265, "y": 65}, {"x": 250, "y": 130}, {"x": 220, "y": 155}, {"x": 190, "y": 150}, {"x": 170, "y": 175}, {"x": 190, "y": 195}, {"x": 145, "y": 210}]});
EST_LAP_SEC.GT3.push(135); EST_LAP_SEC.F1.push(105);
TRACKS_DB.push({"id": "portimao", "name": "🇵🇹 Портиман", "shortName": "Портиман", "desc": "Слепые вершины · упрощённая схема", "scale": 75, "pitSideSign": 1, "theme": {"grassBase": "#173c2c", "grassAlt": "#143425", "runoffColor": "#334155"}, "drsZones": [{"detect": 0.82, "start": 0.86, "end": 0.98}], "rawPoints": [{"x": 100, "y": 190}, {"x": 60, "y": 160}, {"x": 50, "y": 120}, {"x": 70, "y": 100}, {"x": 55, "y": 70}, {"x": 80, "y": 40}, {"x": 115, "y": 55}, {"x": 130, "y": 90}, {"x": 155, "y": 70}, {"x": 165, "y": 35}, {"x": 205, "y": 25}, {"x": 230, "y": 55}, {"x": 210, "y": 85}, {"x": 235, "y": 110}, {"x": 220, "y": 150}, {"x": 180, "y": 145}, {"x": 150, "y": 170}, {"x": 170, "y": 195}, {"x": 135, "y": 210}]});
EST_LAP_SEC.GT3.push(132); EST_LAP_SEC.F1.push(103);
TRACKS_DB.push({"id": "lemans", "name": "🇫🇷 Ле-Ман", "shortName": "Ле-Ман", "desc": "Длинные прямые и шиканы · упрощённая схема", "scale": 75, "pitSideSign": 1, "theme": {"grassBase": "#173c2c", "grassAlt": "#143425", "runoffColor": "#334155"}, "drsZones": [{"detect": 0.82, "start": 0.86, "end": 0.98}], "rawPoints": [{"x": 95, "y": 220}, {"x": 65, "y": 190}, {"x": 60, "y": 160}, {"x": 80, "y": 140}, {"x": 85, "y": 95}, {"x": 92, "y": 55}, {"x": 110, "y": 35}, {"x": 120, "y": 45}, {"x": 125, "y": 100}, {"x": 132, "y": 110}, {"x": 125, "y": 125}, {"x": 130, "y": 190}, {"x": 145, "y": 205}, {"x": 170, "y": 225}, {"x": 190, "y": 210}, {"x": 205, "y": 175}, {"x": 215, "y": 140}, {"x": 195, "y": 120}, {"x": 172, "y": 145}, {"x": 160, "y": 178}, {"x": 145, "y": 190}, {"x": 125, "y": 200}]});
EST_LAP_SEC.GT3.push(235); EST_LAP_SEC.F1.push(183);
TRACKS_DB.push({"id": "fuji", "name": "🇯🇵 Фудзи", "shortName": "Фудзи", "desc": "Прямая и технический сектор · упрощённая схема", "scale": 75, "pitSideSign": 1, "theme": {"grassBase": "#173c2c", "grassAlt": "#143425", "runoffColor": "#334155"}, "drsZones": [{"detect": 0.82, "start": 0.86, "end": 0.98}], "rawPoints": [{"x": 100, "y": 180}, {"x": 220, "y": 180}, {"x": 260, "y": 165}, {"x": 250, "y": 140}, {"x": 215, "y": 125}, {"x": 190, "y": 90}, {"x": 165, "y": 70}, {"x": 130, "y": 65}, {"x": 105, "y": 85}, {"x": 125, "y": 105}, {"x": 150, "y": 100}, {"x": 145, "y": 130}, {"x": 115, "y": 145}, {"x": 90, "y": 132}, {"x": 65, "y": 145}, {"x": 60, "y": 172}]});
EST_LAP_SEC.GT3.push(138); EST_LAP_SEC.F1.push(108);
TRACKS_DB.push({"id": "sebring", "name": "🇺🇸 Себринг", "shortName": "Себринг", "desc": "Выносливость и быстрые дуги · упрощённая схема", "scale": 75, "pitSideSign": 1, "theme": {"grassBase": "#173c2c", "grassAlt": "#143425", "runoffColor": "#334155"}, "drsZones": [{"detect": 0.82, "start": 0.86, "end": 0.98}], "rawPoints": [{"x": 100, "y": 185}, {"x": 50, "y": 175}, {"x": 25, "y": 145}, {"x": 35, "y": 90}, {"x": 60, "y": 70}, {"x": 100, "y": 85}, {"x": 125, "y": 65}, {"x": 160, "y": 25}, {"x": 195, "y": 40}, {"x": 180, "y": 80}, {"x": 155, "y": 100}, {"x": 180, "y": 125}, {"x": 220, "y": 130}, {"x": 250, "y": 155}, {"x": 235, "y": 180}, {"x": 190, "y": 195}, {"x": 140, "y": 190}]});
EST_LAP_SEC.GT3.push(155); EST_LAP_SEC.F1.push(121);
TRACKS_DB.push({"id": "qatar", "name": "🇶🇦 Лусаил", "shortName": "Лусаил", "desc": "Скоростные дуги · упрощённая схема", "scale": 75, "pitSideSign": 1, "theme": {"grassBase": "#173c2c", "grassAlt": "#143425", "runoffColor": "#334155"}, "drsZones": [{"detect": 0.82, "start": 0.86, "end": 0.98}], "rawPoints": [{"x": 100, "y": 190}, {"x": 60, "y": 160}, {"x": 50, "y": 115}, {"x": 75, "y": 90}, {"x": 65, "y": 60}, {"x": 100, "y": 30}, {"x": 140, "y": 40}, {"x": 150, "y": 70}, {"x": 180, "y": 90}, {"x": 210, "y": 70}, {"x": 235, "y": 90}, {"x": 220, "y": 120}, {"x": 235, "y": 150}, {"x": 205, "y": 175}, {"x": 165, "y": 160}, {"x": 145, "y": 190}]});
EST_LAP_SEC.GT3.push(133); EST_LAP_SEC.F1.push(104);
TRACKS_DB.push({"id": "hungaroring", "name": "🇭🇺 Хунгароринг", "shortName": "Хунгароринг", "desc": "Тесные повороты · упрощённая схема", "scale": 75, "pitSideSign": 1, "theme": {"grassBase": "#173c2c", "grassAlt": "#143425", "runoffColor": "#334155"}, "drsZones": [{"detect": 0.82, "start": 0.86, "end": 0.98}], "rawPoints": [{"x": 100, "y": 190}, {"x": 170, "y": 190}, {"x": 210, "y": 170}, {"x": 200, "y": 145}, {"x": 170, "y": 135}, {"x": 180, "y": 105}, {"x": 155, "y": 80}, {"x": 165, "y": 50}, {"x": 130, "y": 30}, {"x": 100, "y": 55}, {"x": 105, "y": 85}, {"x": 75, "y": 100}, {"x": 60, "y": 80}, {"x": 35, "y": 100}, {"x": 40, "y": 140}, {"x": 75, "y": 155}, {"x": 70, "y": 175}]});
EST_LAP_SEC.GT3.push(130); EST_LAP_SEC.F1.push(101);
TRACKS_DB.push({"id": "redbullring", "name": "🇦🇹 Ред Булл Ринг", "shortName": "Ред Булл Ринг", "desc": "Разгоны и шпильки · упрощённая схема", "scale": 75, "pitSideSign": 1, "theme": {"grassBase": "#173c2c", "grassAlt": "#143425", "runoffColor": "#334155"}, "drsZones": [{"detect": 0.82, "start": 0.86, "end": 0.98}], "rawPoints": [{"x": 100, "y": 190}, {"x": 180, "y": 160}, {"x": 195, "y": 125}, {"x": 210, "y": 60}, {"x": 190, "y": 30}, {"x": 135, "y": 40}, {"x": 90, "y": 65}, {"x": 55, "y": 95}, {"x": 40, "y": 135}, {"x": 65, "y": 150}, {"x": 95, "y": 145}, {"x": 120, "y": 160}]});
EST_LAP_SEC.GT3.push(115); EST_LAP_SEC.F1.push(90);
TRACKS_DB.push({"id":"monaco","name":"🇲🇨 Монако","shortName":"Монако","desc":"Детализированный городской контур: Sainte Dévote, Casino, Fairmont, тоннель, Piscine и Rascasse","scale":42,"pitSideSign":-1,"theme":{"grassBase":"#173c2c","grassAlt":"#143425","runoffColor":"#334155"},"drsZones":[{"detect":0.82,"start":0.86,"end":0.98}],"rawPoints":[{"x":58,"y":333},{"x":56,"y":300},{"x":57,"y":266},{"x":77,"y":233},{"x":91,"y":226},{"x":113,"y":230},{"x":173,"y":230},{"x":230,"y":230},{"x":290,"y":225},{"x":316,"y":214},{"x":328,"y":189},{"x":320,"y":150},{"x":341,"y":127},{"x":373,"y":99},{"x":395,"y":80},{"x":404,"y":74},{"x":406,"y":110},{"x":401,"y":146},{"x":392,"y":161},{"x":386,"y":182},{"x":390,"y":194},{"x":400,"y":194},{"x":408,"y":179},{"x":416,"y":137},{"x":428,"y":129},{"x":445,"y":131},{"x":451,"y":145},{"x":448,"y":161},{"x":431,"y":182},{"x":407,"y":205},{"x":373,"y":226},{"x":329,"y":240},{"x":282,"y":248},{"x":247,"y":253},{"x":234,"y":258},{"x":225,"y":249},{"x":217,"y":260},{"x":207,"y":267},{"x":194,"y":258},{"x":181,"y":262},{"x":152,"y":265},{"x":116,"y":265},{"x":105,"y":276},{"x":99,"y":300},{"x":98,"y":324},{"x":93,"y":350},{"x":91,"y":371},{"x":96,"y":390},{"x":113,"y":399},{"x":128,"y":414},{"x":138,"y":431},{"x":134,"y":440},{"x":118,"y":443},{"x":105,"y":436},{"x":94,"y":425},{"x":84,"y":432},{"x":79,"y":447},{"x":67,"y":451},{"x":60,"y":435},{"x":59,"y":403},{"x":61,"y":373}],"pitRoutePoints":[{"x":94,"y":425},{"x":90,"y":402},{"x":83,"y":374},{"x":79,"y":338},{"x":80,"y":308},{"x":82,"y":285},{"x":85,"y":261},{"x":83,"y":242}],"layoutVersion":"monaco-city-2026"});
EST_LAP_SEC.GT3.push(115); EST_LAP_SEC.F1.push(90);
