/**
 * Standard Car Insurance Select Options with TTS and Validation Flags
 * 
 * Each option list includes:
 * - vodflag: Validation flag for auto-invocation
 * - validator: Zod validator name
 * - fieldType: Input field type
 * - options: Array of selectable options with TTS variants
 */

export const carInsuranceOptions = {
    // Gender
    gender: {
        vodflag: 'isGender',
        validator: 'isGender',
        fieldType: 'select',
        options: [
            {
                label: "Male",
                value: "male",
                tts: {
                    variant1: "What is your gender? Please say male, female, or non-binary.",
                    variant2: "Could you tell me your gender? Male, female, or non-binary?",
                    variant3: "Please select your gender: male, female, or non-binary.",
                    variant4: "What gender should I record? Male, female, or non-binary?"
                }
            },
            {
                label: "Female",
                value: "female"
            },
            {
                label: "Non-binary",
                value: "non_binary"
            }
        ]
    },

    // Car Parking - Overnight
    parkingOvernight: {
        vodflag: 'isParkingLocation',
        validator: 'isParkingLocation',
        fieldType: 'select',
        options: [
            {
                label: "Garage",
                value: "garage",
                tts: {
                    variant1: "Where is your car parked overnight? For example, garage, driveway, street, or car park.",
                    variant2: "Where do you park your car at night? Garage, driveway, on the street, or in a car park?",
                    variant3: "Please tell me where your vehicle is kept overnight. Garage, driveway, street, or car park?",
                    variant4: "Where is your car usually parked during the night? Garage, driveway, street, or car park?"
                }
            },
            {
                label: "Driveway",
                value: "driveway"
            },
            {
                label: "Street",
                value: "street"
            },
            {
                label: "Car Park",
                value: "car_park"
            },
            {
                label: "Private Land",
                value: "private_land"
            },
            {
                label: "Secure Compound",
                value: "secure_compound"
            }
        ]
    },

    // Car Parking - Daytime
    parkingDaytime: {
        vodflag: 'isParkingLocation',
        validator: 'isParkingLocation',
        fieldType: 'select',
        options: [
            {
                label: "Home",
                value: "home",
                tts: {
                    variant1: "Where is your car parked during the day? At home, work car park, public car park, or on the street?",
                    variant2: "During daytime, where do you usually park? Home, work, public car park, or street?",
                    variant3: "Please tell me where your car is kept during the day. Home, work car park, public car park, or street?",
                    variant4: "Where is your vehicle parked in the daytime? Home, work, public car park, or on the street?"
                }
            },
            {
                label: "Work Car Park",
                value: "work_car_park"
            },
            {
                label: "Public Car Park",
                value: "public_car_park"
            },
            {
                label: "Street",
                value: "street"
            },
            {
                label: "Varies",
                value: "varies"
            }
        ]
    },

    // UK DVLA Driving Offences
    drivingOffences: {
        vodflag: 'isUKDrivingOffence',
        validator: 'isUKDrivingOffence',
        fieldType: 'select',
        multiSelect: true,
        options: [
            {
                label: "No Offences",
                value: "none",
                tts: {
                    variant1: "Do you have any driving offences or convictions? Please say the offence code, or say none if you have no offences.",
                    variant2: "Have you had any driving convictions? Tell me the offence code, or say none.",
                    variant3: "Please tell me about any driving offences. Say the code, or none if you have a clean record.",
                    variant4: "Do you have any points or convictions on your licence? Say the offence code or none."
                }
            },
            // Speeding Offences
            {
                label: "SP10 - Exceeding goods vehicle speed limit",
                value: "SP10"
            },
            {
                label: "SP20 - Exceeding speed limit for type of vehicle",
                value: "SP20"
            },
            {
                label: "SP30 - Exceeding statutory speed limit on a public road",
                value: "SP30"
            },
            {
                label: "SP40 - Exceeding passenger vehicle speed limit",
                value: "SP40"
            },
            {
                label: "SP50 - Exceeding speed limit on a motorway",
                value: "SP50"
            },
            // Careless Driving
            {
                label: "CD10 - Driving without due care and attention",
                value: "CD10"
            },
            {
                label: "CD20 - Driving without reasonable consideration for other road users",
                value: "CD20"
            },
            {
                label: "CD30 - Driving without due care and attention or without reasonable consideration",
                value: "CD30"
            },
            // Reckless/Dangerous Driving
            {
                label: "DD10 - Causing serious injury by dangerous driving",
                value: "DD10"
            },
            {
                label: "DD40 - Dangerous driving",
                value: "DD40"
            },
            {
                label: "DD60 - Manslaughter or culpable homicide while driving a vehicle",
                value: "DD60"
            },
            {
                label: "DD80 - Causing death by dangerous driving",
                value: "DD80"
            },
            // Drink/Drug Driving
            {
                label: "DR10 - Driving or attempting to drive with alcohol level above limit",
                value: "DR10"
            },
            {
                label: "DR20 - Driving or attempting to drive while unfit through drink",
                value: "DR20"
            },
            {
                label: "DR30 - Driving or attempting to drive then failing to supply a specimen for analysis",
                value: "DR30"
            },
            {
                label: "DR40 - In charge of a vehicle while alcohol level above limit",
                value: "DR40"
            },
            {
                label: "DR50 - In charge of a vehicle while unfit through drink",
                value: "DR50"
            },
            {
                label: "DR60 - Failure to provide a specimen for analysis in circumstances other than driving",
                value: "DR60"
            },
            {
                label: "DR70 - Failing to provide specimen for breath test",
                value: "DR70"
            },
            {
                label: "DR80 - Driving or attempting to drive when unfit through drugs",
                value: "DR80"
            },
            {
                label: "DR90 - In charge of a vehicle when unfit through drugs",
                value: "DR90"
            },
            // Insurance Offences
            {
                label: "IN10 - Using a vehicle uninsured against third party risks",
                value: "IN10"
            },
            // Licence Offences
            {
                label: "LC20 - Driving otherwise than in accordance with a licence",
                value: "LC20"
            },
            {
                label: "LC30 - Driving after making a false declaration about fitness when applying for a licence",
                value: "LC30"
            },
            {
                label: "LC40 - Driving a vehicle having failed to notify a disability",
                value: "LC40"
            },
            {
                label: "LC50 - Driving after a licence has been revoked or refused on medical grounds",
                value: "LC50"
            },
            // Mobile Phone
            {
                label: "CU80 - Breach of requirements as to control of the vehicle, mobile phone etc.",
                value: "CU80"
            },
            // Traffic Signals
            {
                label: "TS10 - Failing to comply with traffic light signals",
                value: "TS10"
            },
            {
                label: "TS20 - Failing to comply with double white lines",
                value: "TS20"
            },
            {
                label: "TS30 - Failing to comply with a 'Stop' sign",
                value: "TS30"
            },
            {
                label: "TS40 - Failing to comply with direction of a constable or traffic warden",
                value: "TS40"
            },
            {
                label: "TS50 - Failing to comply with a traffic sign",
                value: "TS50"
            },
            {
                label: "TS60 - Failing to comply with school crossing patrol sign",
                value: "TS60"
            },
            {
                label: "TS70 - Undefined failure to comply with a traffic direction sign",
                value: "TS70"
            }
        ]
    },

    // UK Driving Licence Categories
    licenceCategories: {
        vodflag: 'isUKDrivingLicenceCategory',
        validator: 'isUKDrivingLicenceCategory',
        fieldType: 'select',
        multiSelect: true,
        options: [
            {
                label: "Category A - Motorcycles",
                value: "A",
                tts: {
                    variant1: "What vehicle categories are you licensed to drive? For example, category B for cars, category A for motorcycles, or category C for lorries.",
                    variant2: "Which vehicle types can you drive? Say the category letter, like B for car, A for motorcycle, or C for lorry.",
                    variant3: "Please tell me your driving licence categories. B for cars, A for motorcycles, C for goods vehicles, and so on.",
                    variant4: "What categories are on your driving licence? For instance, B for cars, A for bikes, C for trucks?"
                }
            },
            {
                label: "Category A1 - Light motorcycles (up to 125cc)",
                value: "A1"
            },
            {
                label: "Category A2 - Medium motorcycles (up to 35kW)",
                value: "A2"
            },
            {
                label: "Category AM - Mopeds",
                value: "AM"
            },
            {
                label: "Category B - Cars (up to 3,500kg)",
                value: "B"
            },
            {
                label: "Category B1 - Motor tricycles",
                value: "B1"
            },
            {
                label: "Category BE - Car with trailer",
                value: "BE"
            },
            {
                label: "Category C - Medium goods vehicles (3,500kg to 7,500kg)",
                value: "C"
            },
            {
                label: "Category C1 - Large goods vehicles (over 7,500kg)",
                value: "C1"
            },
            {
                label: "Category CE - Large goods vehicle with trailer",
                value: "CE"
            },
            {
                label: "Category C1E - Medium goods vehicle with trailer",
                value: "C1E"
            },
            {
                label: "Category D - Bus (more than 8 passenger seats)",
                value: "D"
            },
            {
                label: "Category D1 - Minibus (9 to 16 passenger seats)",
                value: "D1"
            },
            {
                label: "Category DE - Bus with trailer",
                value: "DE"
            },
            {
                label: "Category D1E - Minibus with trailer",
                value: "D1E"
            },
            {
                label: "Category F - Agricultural tractor",
                value: "F"
            },
            {
                label: "Category G - Road roller",
                value: "G"
            },
            {
                label: "Category H - Tracked vehicle",
                value: "H"
            },
            {
                label: "Category K - Mowing machine or pedestrian-controlled vehicle",
                value: "K"
            },
            {
                label: "Category L - Electric vehicle",
                value: "L"
            },
            {
                label: "Category P - Moped (up to 50cc)",
                value: "P"
            },
            {
                label: "Category Q - Two-wheeled and three-wheeled vehicles without pedals",
                value: "Q"
            }
        ]
    },

    // Vehicle Type
    vehicleType: {
        vodflag: 'isVehicleType',
        validator: 'isVehicleType',
        fieldType: 'select',
        options: [
            {
                label: "Saloon",
                value: "saloon",
                tts: {
                    variant1: "What type of vehicle is it? For example, saloon, hatchback, estate, SUV, or convertible.",
                    variant2: "What kind of car do you have? Saloon, hatchback, estate, SUV, convertible, or something else?",
                    variant3: "Please tell me your vehicle type. Saloon, hatchback, estate, four-by-four, or convertible?",
                    variant4: "What's your car body type? Saloon, hatchback, estate, SUV, or convertible?"
                }
            },
            {
                label: "Hatchback",
                value: "hatchback"
            },
            {
                label: "Estate",
                value: "estate"
            },
            {
                label: "SUV / 4x4",
                value: "suv"
            },
            {
                label: "Convertible",
                value: "convertible"
            },
            {
                label: "Coupe",
                value: "coupe"
            },
            {
                label: "MPV / People Carrier",
                value: "mpv"
            },
            {
                label: "Van",
                value: "van"
            }
        ]
    },

    // Cover Type
    coverType: {
        vodflag: 'isCoverType',
        validator: 'isCoverType',
        fieldType: 'select',
        options: [
            {
                label: "Comprehensive",
                value: "comprehensive",
                tts: {
                    variant1: "What level of cover do you need? Comprehensive, third party fire and theft, or third party only?",
                    variant2: "Which type of insurance cover would you like? Comprehensive, third party fire and theft, or just third party?",
                    variant3: "Please choose your cover level. Comprehensive, third party fire and theft, or third party only?",
                    variant4: "What insurance cover are you looking for? Comprehensive, third party with fire and theft, or third party?"
                }
            },
            {
                label: "Third Party, Fire and Theft",
                value: "third_party_fire_theft"
            },
            {
                label: "Third Party Only",
                value: "third_party"
            }
        ]
    },

    // Main Use of Vehicle
    vehicleUse: {
        vodflag: 'isVehicleUse',
        validator: 'isVehicleUse',
        fieldType: 'select',
        options: [
            {
                label: "Social, Domestic and Pleasure",
                value: "sdp",
                tts: {
                    variant1: "What is the main use of your vehicle? Social domestic and pleasure, commuting, or business use?",
                    variant2: "How do you mainly use your car? For social and pleasure, commuting to work, or business purposes?",
                    variant3: "Please tell me your vehicle's main use. Social and domestic, commuting, or business?",
                    variant4: "What's the primary use of your car? Social domestic and pleasure, commuting, or business?"
                }
            },
            {
                label: "Social, Domestic, Pleasure and Commuting",
                value: "sdp_commuting"
            },
            {
                label: "Business Use",
                value: "business"
            },
            {
                label: "Commercial Travelling",
                value: "commercial"
            }
        ]
    },

    // Annual Mileage
    annualMileage: {
        vodflag: 'isAnnualMileage',
        validator: 'isAnnualMileage',
        fieldType: 'select',
        options: [
            {
                label: "Up to 5,000 miles",
                value: "0-5000",
                tts: {
                    variant1: "What is your estimated annual mileage? For example, up to five thousand, five to ten thousand, or over twenty thousand miles per year.",
                    variant2: "How many miles do you drive per year? Up to five thousand, five to ten thousand, ten to fifteen thousand, or more?",
                    variant3: "Please tell me your yearly mileage. Under five thousand, five to ten thousand, or over twenty thousand miles?",
                    variant4: "What's your annual mileage? Up to five thousand miles, five to ten thousand, or more than twenty thousand?"
                }
            },
            {
                label: "5,000 - 10,000 miles",
                value: "5000-10000"
            },
            {
                label: "10,000 - 15,000 miles",
                value: "10000-15000"
            },
            {
                label: "15,000 - 20,000 miles",
                value: "15000-20000"
            },
            {
                label: "20,000 - 30,000 miles",
                value: "20000-30000"
            },
            {
                label: "Over 30,000 miles",
                value: "30000+"
            }
        ]
    }
};

/**
 * Helper function to get options by vodflag
 * @param {string} vodflag - Validation flag
 * @returns {Array} Options array
 */
export function getOptionsByVodflag(vodflag) {
    for (const [key, value] of Object.entries(carInsuranceOptions)) {
        if (value.vodflag === vodflag) {
            return value.options;
        }
    }
    return [];
}

/**
 * Helper function to get all vodflags
 * @returns {Array} Array of all vodflags
 */
export function getAllVodflags() {
    return Object.values(carInsuranceOptions).map(item => item.vodflag);
}

/**
 * Validation flag to option list mapping
 */
export const vodflagMapping = {
    'isGender': 'gender',
    'isParkingLocation': 'parkingOvernight', // or parkingDaytime
    'isUKDrivingOffence': 'drivingOffences',
    'isUKDrivingLicenceCategory': 'licenceCategories',
    'isVehicleType': 'vehicleType',
    'isCoverType': 'coverType',
    'isVehicleUse': 'vehicleUse',
    'isAnnualMileage': 'annualMileage'
};

export default carInsuranceOptions;
