export interface KpiDef {
  id: string;
  name: string;
  target: string;
  measure: string;
  def: string;
  /** [band10, band8_9, band5_7, below5] */
  bands: [string, string, string, string];
}

export interface AreaDef {
  id: string;
  name: string;
  short: string;
  weight: number;
  kpis: KpiDef[];
}

export interface Scorecard {
  key: string;
  label: string;
  /** Filter used against `staffing_people.role_category` (case-insensitive). */
  roleCategoryMatch: RegExp;
  areas: AreaDef[];
}