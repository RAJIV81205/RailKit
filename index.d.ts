/**
 * Configure the SDK with your API key before using any other function.
 * The backend URL is managed by the package - you only need your API key.
 *
 * @param apiKey - API key from the RailKit dashboard
 * @example
 * configure('your-api-key-here');
 */
export function configure(apiKey: string): void;

/**
 * Check the PNR status for a given 10-digit PNR number.
 *
 * @param pnr - 10-digit PNR number
 * @example
 * const result = await checkPNRStatus('1234567890');
 * 
 */
export function checkPNRStatus(pnr: string): Promise<any>;

/**
 * Get detailed information and route for a given 5-digit train number.
 *
 * @param trainNumber - 5-digit train number
 * @example
 * const result = await getTrainInfo('12301');
 * 
 */
export function getTrainInfo(trainNumber: string): Promise<any>;

/**
 * Get the live running status of a train.
 * @param trainNumber - 5-digit train number
 * @param date - Journey date in DD-MM-YYYY format (optional, defaults to today)
 *
 * @example
 * const result = await trackTrain('12301', '15-04-2025');
 *
 */
export function trackTrain(trainNumber: string, date?: string): Promise<any>;

/**
 * Get the completed journey history of a train for a specific journey date.
 * Returns the persisted TrainHistory record once the train has reached its
 * destination, including the full station-by-station timeline, per-stop delays,
 * and the final coach position.
 * 
 * @param trainNumber - 5-digit train number
 * @param journeyDate - Journey date in DD-MM-YYYY format
 *
 * @example
 * const result = await getTrainHistory('12301', '15-04-2025');
 */
export function getTrainHistory(trainNumber: string, journeyDate: string): Promise<any>;

/**
 * Get the list of upcoming trains at a station.
 * @param stationCode - Station code (e.g., 'NDLS' for New Delhi)
 * @param hours - Time window in hours: 2, 4, or 8 (default 2)
 *
 * @example
 * const result = await liveAtStation('NDLS', 2);
 */
export function liveAtStation(stationCode: string, hours?: 2 | 4 | 8): Promise<any>;

/**
 * Search for all direct trains between two stations.
 * @param fromStnCode - Source station code
 * @param toStnCode - Destination station code
 * @param date - Journey date in DD-MM-YYYY format (optional)
 *
 * @example
 * const result = await searchTrainBetweenStations('NDLS', 'BCT', '15-04-2025');
 */
export function searchTrainBetweenStations(fromStnCode: string, toStnCode: string, date?: string): Promise<any>;

/**
 * Check seat availability for a specific train, class, and date.
 * @param trainNo - 5-digit train number
 * @param fromStnCode - Source station code
 * @param toStnCode - Destination station code
 * @param date - Journey date in DD-MM-YYYY format
 * @param coach - '2S' | 'SL' | '3A' | '3E' | '2A' | '1A' | 'CC' | 'EC'
 * @param quota - 'GN' | 'LD' | 'SS' | 'TQ'
 *
 * @example
 * const result = await getAvailability('12301', 'NDLS', 'HWH', '15-04-2025', '3A', 'GN');
 * 
 */
export function getAvailability(
  trainNo: string,
  fromStnCode: string,
  toStnCode: string,
  date: string,
  coach: string,
  quota: string
): Promise<any>;

/**
 * Get the fare breakdown for a train journey.
 * Returns baseFare, reservation, superfast, catering, GST, dynamicFare and totalFare.
 * 
 * @param trainNo - 5-digit train number
 * @param fromStnCode - Source station code
 * @param toStnCode - Destination station code
 * @param date - Journey date in DD-MM-YYYY format
 * @param travelClass - '1A' | '2A' | '3A' | '3E' | 'CC' | 'EC' | 'EA' | 'FC' | 'SL' | '2S' | 'VS' | 'CH' | 'HS' | 'VC' | 'VA'
 * @param quota       - 'GN' | 'TQ' | 'LD' | 'DF' | 'FT' | 'LB' | 'PT' | 'YU' | 'DP' | 'HP' | 'PH' | 'SS'
 *
 * @example
 * const result = await fareLookup('12313', 'ASN', 'NDLS', '06-06-2026', '3A', 'GN');
 */
export function fareLookup(
  trainNo: string,
  fromStnCode: string,
  toStnCode: string,
  date: string,
  travelClass: string,
  quota: string
): Promise<any>;

/**
 * Get all fully and partially cancelled trains.
 *
 * @example
 * const result = await cancelList();
 */
export function cancelList(): Promise<any>;

/**
 * Resolve a station code to its name and coordinates.
 * @param stationCode - Station code of 1-5 letters or digits
 */
export function stationByCode(stationCode: string): Promise<any>;

/**
 * Find up to 10 stations matching a partial name.
 * @param name - Partial station name, at least 2 characters
 */
export function stationsByName(name: string): Promise<any>;

/**
 * Resolve an exact 5-digit train number to its stored train name.
 * @param trainNumber - Exactly 5 numeric digits
 */
export function trainByNumber(trainNumber: string): Promise<any>;

/**
 * Find up to 10 trains matching a partial name.
 * @param name - Partial train name, at least 2 characters
 */
export function trainsByName(name: string): Promise<any>;

/**
 * Get the complete station timetable.
 * Omit date for all trains; supplied date must be DD-MM-YYYY and today,
 * yesterday, or tomorrow.
 * @param stationCode - Station code of 1-5 letters or digits
 * @param date - Optional date in DD-MM-YYYY format
 */
export function trainTimetableAtStation(stationCode: string, date?: string): Promise<any>;
