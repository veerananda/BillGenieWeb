export type CityTier = 'tier_1' | 'tier_2' | 'tier_3';

export interface DistrictTierOption {
  name: string;
  tier: CityTier;
}

export interface StateDistrictOptions {
  state: string;
  districts: DistrictTierOption[];
}

const tier1 = (...names: string[]): DistrictTierOption[] => names.map((name) => ({ name, tier: 'tier_1' }));
const tier2 = (...names: string[]): DistrictTierOption[] => names.map((name) => ({ name, tier: 'tier_2' }));
const tier3 = (): DistrictTierOption[] => [{ name: 'Other district', tier: 'tier_3' }];
const state = (state: string, ...groups: DistrictTierOption[][]): StateDistrictOptions => ({
  state,
  districts: groups.flat(),
});

export const INDIA_LOCATION_OPTIONS: StateDistrictOptions[] = [
  state('Andhra Pradesh', tier2('Visakhapatnam', 'Vijayawada', 'Guntur'), tier3()),
  state('Arunachal Pradesh', tier3()),
  state('Assam', tier2('Kamrup Metropolitan', 'Dibrugarh', 'Silchar'), tier3()),
  state('Bihar', tier2('Patna', 'Muzaffarpur', 'Gaya'), tier3()),
  state('Chhattisgarh', tier2('Raipur', 'Bilaspur', 'Durg'), tier3()),
  state('Goa', tier2('North Goa', 'South Goa'), tier3()),
  state('Gujarat', tier1('Ahmedabad', 'Surat', 'Vadodara'), tier2('Rajkot', 'Gandhinagar', 'Bhavnagar'), tier3()),
  state('Haryana', tier2('Gurugram', 'Faridabad', 'Panipat', 'Hisar'), tier3()),
  state('Himachal Pradesh', tier3()),
  state('Jharkhand', tier2('Ranchi', 'Jamshedpur', 'Dhanbad'), tier3()),
  state('Karnataka', tier1('Bengaluru Urban'), tier2('Mysuru', 'Mangaluru', 'Hubballi-Dharwad', 'Belagavi'), tier3()),
  state('Kerala', tier2('Thiruvananthapuram', 'Ernakulam', 'Kozhikode', 'Thrissur'), tier3()),
  state('Madhya Pradesh', tier2('Indore', 'Bhopal', 'Jabalpur', 'Gwalior'), tier3()),
  state('Maharashtra', tier1('Mumbai City', 'Mumbai Suburban', 'Pune'), tier2('Nagpur', 'Nashik', 'Thane', 'Aurangabad'), tier3()),
  state('Manipur', tier3()),
  state('Meghalaya', tier3()),
  state('Mizoram', tier3()),
  state('Nagaland', tier3()),
  state('Odisha', tier2('Khordha', 'Cuttack', 'Sundargarh'), tier3()),
  state('Punjab', tier2('Ludhiana', 'Amritsar', 'Jalandhar', 'Patiala', 'SAS Nagar'), tier3()),
  state('Rajasthan', tier2('Jaipur', 'Jodhpur', 'Udaipur', 'Kota'), tier3()),
  state('Sikkim', tier3()),
  state('Tamil Nadu', tier1('Chennai'), tier2('Coimbatore', 'Madurai', 'Tiruchirappalli', 'Salem'), tier3()),
  state('Telangana', tier1('Hyderabad'), tier2('Warangal', 'Ranga Reddy', 'Karimnagar'), tier3()),
  state('Tripura', tier3()),
  state('Uttar Pradesh', tier2('Lucknow', 'Kanpur Nagar', 'Ghaziabad', 'Noida', 'Varanasi', 'Agra', 'Prayagraj'), tier3()),
  state('Uttarakhand', tier2('Dehradun', 'Haridwar'), tier3()),
  state('West Bengal', tier1('Kolkata'), tier2('Howrah', 'Darjeeling', 'Siliguri', 'Durgapur'), tier3()),
  state('Andaman and Nicobar Islands', tier3()),
  state('Chandigarh', tier2('Chandigarh'), tier3()),
  state('Dadra and Nagar Haveli and Daman and Diu', tier3()),
  state('Delhi', tier1('New Delhi', 'Central Delhi', 'South Delhi', 'West Delhi', 'North West Delhi'), tier2('South West Delhi', 'East Delhi', 'North Delhi'), tier3()),
  state('Jammu and Kashmir', tier2('Srinagar', 'Jammu'), tier3()),
  state('Ladakh', tier3()),
  state('Lakshadweep', tier3()),
  state('Puducherry', tier2('Puducherry'), tier3()),
];

export function districtsForState(stateName: string): DistrictTierOption[] {
  return INDIA_LOCATION_OPTIONS.find((item) => item.state === stateName)?.districts ?? [];
}

export function resolveCityTier(stateName: string, districtName: string): CityTier {
  return districtsForState(stateName).find((item) => item.name === districtName)?.tier ?? 'tier_3';
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
