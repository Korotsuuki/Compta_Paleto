export type Role = "direction" | "drh" | "gerant" | "chef_equipe" | "employe" | "gouv";
export type Etat = "actif" | "absent";
export type GradeType = "fixe" | "pourcentage";
export type ServiceCategorie = "depannage" | "prestation" | "nettoyage" | "custom";
export type ChargeCategorie = "kits_nourriture" | "matieres_premieres" | "publicite" | "impots" | "autre";

export interface Grade {
  id: string;
  nom: string;
  type: GradeType;
  montant_fixe: number;
  pourcentage: number;
  plafond: number;
  sort_order: number;
  est_mecano: boolean;
}

export interface Profile {
  id: string;
  discord_username: string | null;
  avatar_url: string | null;
  prenom: string | null;
  nom: string | null;
  telephone: string | null;
  date_entree: string | null;
  grade_id: string | null;
  etat: Etat;
  employee_code: string | null;
  role: Role;
  valide: boolean;
}

export interface EmployeeFull extends Profile {
  grade_nom: string | null;
  grade_type: GradeType | null;
  montant_fixe: number | null;
  pourcentage: number | null;
  plafond: number | null;
  ca_global: number;
  ca_repa_net: number;
  cout_customs: number;
  nombre_factures: number;
  salaire: number;
}

export interface Service {
  id: string;
  nom: string;
  prix: number;
  categorie: ServiceCategorie;
  montant_libre: boolean;
  actif: boolean;
  sort_order: number;
}

export interface Facture {
  id: string;
  employee_id: string;
  service_id: string | null;
  montant: number;
  quantite: number;
  client_identite: string | null;
  client_telephone: string | null;
  created_at: string;
}

export interface Charge {
  id: string;
  categorie: ChargeCategorie;
  prestataire: string | null;
  article: string | null;
  date: string;
  montant: number;
  quantite: number;
}

export interface Prime {
  id: string;
  semaine: number;
  date_debut: string;
  montant_max: number;
  montant_verse: number;
}

export interface Partenaire {
  id: string;
  nom: string;
  categorie: string;
  remise_percent: number | null;
  nettoyage_gratuit: boolean;
  avantages_garage: string | null;
  avantages_employes: string | null;
  sort_order: number;
}

export interface Dashboard {
  ca_global: number;
  ca_repa_net: number;
  cout_customs: number;
  total_salaires: number;
  total_charges: number;
  total_impots: number;
  total_primes: number;
  total_employes: number;
  prime_semaine_courante: number;
}

export interface PrimeSemaine {
  date_debut: string;
  montant_max: number;
  montant_verse: number;
  semaine_numero: number;
}

export interface AuditLogEntry {
  id: number;
  table_name: string;
  record_id: string | null;
  action: "INSERT" | "UPDATE" | "DELETE";
  acted_by: string | null;
  old_data: Record<string, any> | null;
  new_data: Record<string, any> | null;
  created_at: string;
}

export interface TransferTarget {
  id: string;
  prenom: string | null;
  nom: string | null;
}

export interface Contrat {
  id: string;
  titre: string;
  partenaire_id: string | null;
  employee_id: string | null;
  contenu: string | null;
  fichier_url: string | null;
  date_signature: string;
}

export interface RegistreHistorique {
  id: string;
  titre: string;
  periode_debut: string;
  periode_fin: string;
  ca_global: number;
  ca_repa_net: number;
  cout_customs: number;
  total_salaires: number;
  total_charges: number;
  total_primes: number;
  benefice_net: number;
  created_at: string;
}

export interface BanqueMouvement {
  id: string;
  type: "depot" | "retrait";
  montant: number;
  motif: string | null;
  date: string;
  created_at: string;
}

export const ROLE_LABELS: Record<Role, string> = {
  direction: "Direction",
  drh: "DRH",
  gerant: "Gérant",
  chef_equipe: "Chef d'équipe",
  employe: "Employé",
  gouv: "Gouv (externe)",
};

// Déduit automatiquement le palier d'accès à partir du nom du grade choisi,
// pour éviter à la Direction de devoir régler grade + rôle séparément.
const GRADE_TO_ROLE: Record<string, Role> = {
  Patron: "direction",
  "Co-Patron": "direction",
  DRH: "drh",
  Gérant: "gerant",
  "Chef d'équipe": "chef_equipe",
};
export const roleForGradeName = (nom: string | null | undefined): Role => GRADE_TO_ROLE[nom ?? ""] ?? "employe";

export const money = (n: number | null | undefined) =>
  new Intl.NumberFormat("fr-FR", { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(n ?? 0) + " $";
