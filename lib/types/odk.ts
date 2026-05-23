/**
 * Types des soumissions ODK brutes.
 *
 * HYPOTHÈSE DOCUMENTÉE :
 * Les formulaires ODK DRC SIA (Households + Outside) exposent un payload JSON via
 * /api/v1/data/{form_id}.json. Les champs sont regroupés par XLSForm groups dont les
 * noms sont préfixés du nom du groupe (ex. "org/province"). Comme le schéma réel
 * n'a pas pu être introspecté hors-ligne, on modélise le payload avec un type
 * "open" qui accepte n'importe quelle clé, tout en déclarant les champs attendus.
 *
 * L'introspection runtime (/api/odk/introspect) détectera la structure réelle.
 * Les mappings des champs vers le modèle de domaine sont dans lib/odk/field-map.ts,
 * donc si les noms diffèrent, seul ce mapping aura à être ajusté.
 */

export type OdkPrimitive = string | number | boolean | null;
export type OdkValue = OdkPrimitive | OdkValue[] | { [k: string]: OdkValue };

export interface OdkSubmissionBase extends Record<string, OdkValue | undefined> {
  _id?: number;
  _uuid?: string;
  _submission_time?: string;
  _submitted_by?: string;
  _xform_id_string?: string;
  _status?: string;
  _attachments?: OdkValue;
  _geolocation?: [number | null, number | null] | null;
  _version?: string;
  meta?: { instanceID?: string };
  formhub?: { uuid?: string };
  start?: string;
  end?: string;
  today?: string;
  deviceid?: string;
}

export interface OdkHouseholdSubmission extends OdkSubmissionBase {
  // Ex. champs attendus (à confirmer via introspection) :
  // "org/province"?: string; "org/antenne"?: string; "org/zs"?: string; "org/as"?: string;
  // "gps/geopoint"?: string; "meta/localite"?: string; "meta/type_monitoring"?: string;
  // "repeat_enfants"?: Array<Record<string, OdkPrimitive>>;
}

export interface OdkOutsideSubmission extends OdkSubmissionBase {}

export type OdkForm = "households" | "outside";

export interface OdkFetchResult<T = OdkSubmissionBase> {
  form: OdkForm;
  count: number;
  fetchedAt: string;
  submissions: T[];
}
