export type CityTier = 'tier_1' | 'tier_2' | 'tier_3';

export interface CityTierOption {
  name: string;
  tier: CityTier;
}

export interface StateCityOptions {
  state: string;
  cities: CityTierOption[];
}

const tier1 = (...names: string[]): CityTierOption[] => names.map((name) => ({ name, tier: 'tier_1' }));
const tier2 = (...names: string[]): CityTierOption[] => names.map((name) => ({ name, tier: 'tier_2' }));
const tier3 = (): CityTierOption[] => [{ name: 'Other city', tier: 'tier_3' }];
const state = (state: string, ...groups: CityTierOption[][]): StateCityOptions => ({
  state,
  cities: groups.flat(),
});

/** MoF HRA X/Y/Z classification: X=Tier-1, Y=Tier-2, Z=Other city (Tier-3). */
export const INDIA_LOCATION_OPTIONS: StateCityOptions[] = [
  state('Andhra Pradesh', tier2('Visakhapatnam', 'Vijayawada', 'Guntur', 'Nellore', 'Kakinada', 'Kurnool', 'Rajahmundry'), tier3()),
  state('Arunachal Pradesh', tier3()),
  state('Assam', tier2('Guwahati'), tier3()),
  state('Bihar', tier2('Patna'), tier3()),
  state('Chhattisgarh', tier2('Raipur', 'Bhilai', 'Bilaspur', 'Durg'), tier3()),
  state('Goa', tier3()),
  state('Gujarat', tier1('Ahmedabad'), tier2('Surat', 'Vadodara', 'Rajkot', 'Jamnagar', 'Bhavnagar', 'Anand', 'Nadiad', 'Dahod', 'Gandhinagar'), tier3()),
  state('Haryana', tier2('Faridabad', 'Gurugram', 'Karnal'), tier3()),
  state('Himachal Pradesh', tier2('Shimla', 'Hamirpur'), tier3()),
  state('Jharkhand', tier2('Jamshedpur', 'Dhanbad', 'Ranchi', 'Bokaro Steel City'), tier3()),
  state('Karnataka', tier1('Bengaluru'), tier2('Belagavi', 'Hubballi-Dharwad', 'Mangaluru', 'Mysuru', 'Kalaburagi', 'Ballari', 'Vijayapura', 'Raichur'), tier3()),
  state('Kerala', tier2('Thiruvananthapuram', 'Kochi', 'Kozhikode', 'Thrissur', 'Malappuram', 'Kannur', 'Kollam'), tier3()),
  state('Madhya Pradesh', tier2('Indore', 'Bhopal', 'Jabalpur', 'Gwalior', 'Ujjain', 'Ratlam'), tier3()),
  state('Maharashtra', tier1('Mumbai', 'Pune'), tier2('Nagpur', 'Nashik', 'Aurangabad', 'Solapur', 'Amravati', 'Kolhapur', 'Sangli', 'Jalgaon', 'Akola', 'Nanded', 'Dhule', 'Bhiwandi', 'Dombivli', 'Vasai-Virar', 'Pimpri-Chinchwad', 'Thane', 'Navi Mumbai', 'Kalyan-Dombivli'), tier3()),
  state('Manipur', tier3()),
  state('Meghalaya', tier3()),
  state('Mizoram', tier3()),
  state('Nagaland', tier3()),
  state('Odisha', tier2('Bhubaneswar', 'Cuttack', 'Rourkela', 'Berhampur'), tier3()),
  state('Punjab', tier2('Ludhiana', 'Amritsar', 'Jalandhar', 'Mohali', 'Patiala'), tier3()),
  state('Rajasthan', tier2('Jaipur', 'Jodhpur', 'Kota', 'Ajmer', 'Bikaner', 'Udaipur'), tier3()),
  state('Sikkim', tier3()),
  state('Tamil Nadu', tier1('Chennai'), tier2('Coimbatore', 'Madurai', 'Tiruchirappalli', 'Salem', 'Tirunelveli', 'Erode', 'Vellore', 'Tiruvannamalai', 'Thanjavur', 'Kumbakonam'), tier3()),
  state('Telangana', tier1('Hyderabad'), tier2('Warangal', 'Karimnagar'), tier3()),
  state('Tripura', tier3()),
  state('Uttar Pradesh', tier2('Lucknow', 'Kanpur', 'Ghaziabad', 'Agra', 'Varanasi', 'Meerut', 'Prayagraj', 'Bareilly', 'Aligarh', 'Moradabad', 'Saharanpur', 'Gorakhpur', 'Noida', 'Jhansi', 'Mathura'), tier3()),
  state('Uttarakhand', tier2('Dehradun'), tier3()),
  state('West Bengal', tier1('Kolkata'), tier2('Asansol', 'Siliguri', 'Durgapur', 'Bardhaman', 'Purulia', 'Howrah'), tier3()),
  state('Andaman and Nicobar Islands', tier3()),
  state('Chandigarh', tier2('Chandigarh'), tier3()),
  state('Dadra and Nagar Haveli and Daman and Diu', tier3()),
  state('Delhi', tier1('Delhi'), tier3()),
  state('Jammu and Kashmir', tier2('Srinagar', 'Jammu'), tier3()),
  state('Ladakh', tier3()),
  state('Lakshadweep', tier3()),
  state('Puducherry', tier2('Puducherry'), tier3()),
];

export function citiesForState(stateName: string): CityTierOption[] {
  return INDIA_LOCATION_OPTIONS.find((item) => item.state === stateName)?.cities ?? [];
}

export function resolveCityTier(stateName: string, cityName: string): CityTier {
  return citiesForState(stateName).find((item) => item.name === cityName)?.tier ?? 'tier_3';
}

export function formatCityTier(tier: CityTier): string {
  switch (tier) {
    case 'tier_1':
      return 'Tier-1';
    case 'tier_2':
      return 'Tier-2';
    default:
      return 'Tier-3';
  }
}
