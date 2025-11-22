/**
 * Example Question Configuration for Cascading Selects
 * 
 * This demonstrates how to configure questions with select options,
 * including cascading selects (e.g., car manufacturer → model)
 */

// Example 1: Simple select with many options (will use SmartSelectWithSearch)
const carManufacturerQuestion = {
    question_id: "q_car_manufacturer",
    question_text: "What is the manufacturer of your car?",
    input_type: "select",
    slot_name: "car_manufacturer",
    required: true,
    options: [
        { value: "toyota", label: "Toyota" },
        { value: "honda", label: "Honda" },
        { value: "ford", label: "Ford" },
        { value: "chevrolet", label: "Chevrolet" },
        { value: "nissan", label: "Nissan" },
        { value: "bmw", label: "BMW" },
        { value: "mercedes", label: "Mercedes-Benz" },
        { value: "audi", label: "Audi" },
        { value: "volkswagen", label: "Volkswagen" },
        { value: "hyundai", label: "Hyundai" },
        { value: "kia", label: "Kia" },
        { value: "mazda", label: "Mazda" },
        { value: "subaru", label: "Subaru" },
        { value: "lexus", label: "Lexus" },
        { value: "volvo", label: "Volvo" },
        { value: "tesla", label: "Tesla" },
        { value: "porsche", label: "Porsche" },
        { value: "jaguar", label: "Jaguar" },
        { value: "land_rover", label: "Land Rover" },
        { value: "jeep", label: "Jeep" }
        // ... more manufacturers
    ],
    tts: {
        variant1: "Which car manufacturer do you have?",
        variant2: "What brand is your car?",
        variant3: "Who makes your vehicle?",
        variant4: "What's the make of your car?"
    }
};

// Example 2: Dependent select (car model based on manufacturer)
// Note: In a real implementation, this would fetch options dynamically
const carModelQuestion = {
    question_id: "q_car_model",
    question_text: "What model is your {car_manufacturer}?",
    input_type: "select",
    slot_name: "car_model",
    required: true,
    dependent_on: "q_car_manufacturer", // This question depends on the previous answer
    options_endpoint: "/api/options/car-models/{car_manufacturer}", // Dynamic options
    // Fallback static options (if API fails)
    options: [],
    tts: {
        variant1: "Which model do you have?",
        variant2: "What's the model of your car?",
        variant3: "Which specific model is it?",
        variant4: "What model did you choose?"
    }
};

// Example 3: Simple select with few options (will use simple buttons)
const insuranceTypeQuestion = {
    question_id: "q_insurance_type",
    question_text: "What type of insurance are you looking for?",
    input_type: "select",
    slot_name: "insurance_type",
    required: true,
    options: [
        { value: "comprehensive", label: "Comprehensive" },
        { value: "third_party", label: "Third Party" },
        { value: "fire_theft", label: "Fire & Theft" }
    ],
    tts: {
        variant1: "What type of insurance do you need?",
        variant2: "Which insurance coverage are you interested in?",
        variant3: "What kind of insurance policy would you like?",
        variant4: "Which coverage type suits you best?"
    }
};

// Example API Response for Dynamic Options
// GET /api/options/car-models/toyota
const toyotaModelsResponse = {
    options: [
        { value: "camry", label: "Camry" },
        { value: "corolla", label: "Corolla" },
        { value: "rav4", label: "RAV4" },
        { value: "highlander", label: "Highlander" },
        { value: "tacoma", label: "Tacoma" },
        { value: "4runner", label: "4Runner" },
        { value: "prius", label: "Prius" },
        { value: "sienna", label: "Sienna" },
        { value: "tundra", label: "Tundra" },
        { value: "avalon", label: "Avalon" }
    ]
};

export {
    carManufacturerQuestion,
    carModelQuestion,
    insuranceTypeQuestion,
    toyotaModelsResponse
};
