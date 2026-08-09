import { ContratChamps } from "@/lib/types";

export const REPRESENTANTS = "Séraphin Yrius et Wiley Scott";

const fmtDate = (d: string | null | undefined) => {
  if (!d) return "________";
  const date = new Date(d);
  if (isNaN(date.getTime())) return "________";
  return date.toLocaleDateString("fr-FR");
};

const val = (v: string | null | undefined) => (v && v.trim() ? v : "________");

export interface ContractSection {
  heading?: string;
  paragraphs: string[];
  bullets?: string[];
}

/**
 * Contrat de travail complet — reprend le modèle fourni, avec les champs
 * variables remplacés par les vraies valeurs (ou un blanc à compléter).
 */
export function buildContratInitial(c: ContratChamps): ContractSection[] {
  return [
    {
      paragraphs: [
        `Entre les soussignés :`,
        `L'entreprise, Paleto Garage, Paleto Bay, Blaine County, San Andréas, Représentée par ${REPRESENTANTS}`,
        `et l'employé, ${val(c.nom_prenom)}`,
        `Né le ${fmtDate(c.date_naissance)} à ${val(c.ville_naissance)}`,
        `De nationalité ${val(c.nationalite)}`,
        `Numéro de téléphone : ${val(c.telephone)}`,
        `Numéro de sécurité sociale : ${val(c.numero_secu)}`,
        `Visite médicale faite le : ${fmtDate(c.date_visite_medicale)}`,
      ],
    },
    {
      heading: "Préambule",
      paragraphs: [
        "Les clauses de ce contrat, ainsi que lui-même, ne seront prises en compte et ne commenceront que lorsque les deux parties auront signé, lu et approuvé celles-ci. En le signant, les deux parties approuvent le contrat, ses clauses et les conditions générales.",
      ],
    },
    {
      heading: "Conditions générales",
      paragraphs: [
        "Les conditions générales de ce contrat, ainsi que lui-même, ne seront prises en compte et ne commenceront que lorsque les deux parties auront signé, lu et approuvé celles-ci.",
      ],
    },
    {
      heading: "Article 1 - Objet du Contrat",
      paragraphs: [
        "Le présent contrat a pour but de définir les modalités du contrat entre l'entreprise et le/la présent(e) employé(e), dans le cadre de leurs activités respectives sur le territoire de San Andréas.",
      ],
    },
    {
      heading: "Article 2 - Obligations",
      paragraphs: [
        "Les deux parties devront – après la signature du contrat – répondre de leurs obligations comme stipulé dans le préambule.",
      ],
    },
    {
      heading: "Article 3 - Durée",
      paragraphs: [`Le contrat prend effet à partir du ${fmtDate(c.date_debut_contrat)} et est établi pour :`],
      bullets: ["une durée indéterminée"],
    },
    {
      heading: "Article 4 - Période d'essai",
      paragraphs: [
        "L'employé(e) est soumis à une période d'essai de 7 jours à compter du jour où le contrat prend effet. Si à l'issue de cette période, la direction n'a pas exprimé le souhait de mettre fin à celle-ci, elle sera considérée comme validée. L'une ou l'autre des parties peut, à tout moment, rompre sans justification le contrat durant la période d'essai.",
      ],
    },
    {
      heading: "Article 5 - Fonctions et responsabilités",
      paragraphs: [
        "L'employé(e) s'engage à exercer ses fonctions au sein de l'entreprise dans le respect du règlement intérieur.",
      ],
    },
    {
      heading: "Article 6 : Rémunération",
      paragraphs: [
        "Le montant du salaire sera fixé comme suit : le/la salarié(e) percevra " + c.salaire_texte + ".",
        "Le salaire sera versé le dimanche (au plus tard le lundi soir). En cas de retard de paiement supérieur à deux jours ouvrés imputable à l'employeur, celui-ci s'engage à verser l'intégralité du salaire dû, majoré de 10 %.",
      ],
      bullets: [
        "Les pourboires sont laissés à l'appréciation des clients.",
        "Des bonus peuvent être accordés en fonction des performances et de l'implication.",
      ],
    },
    {
      heading: "Article 7 - Équipement",
      paragraphs: [
        "L'entreprise s'engage à mettre à disposition de l'employé tous les outils nécessaires à l'accomplissement de ses missions.",
        "L'employé(e) se verra ainsi confier le matériel indispensable à la réalisation de ses tâches.",
        "L'usage privé des véhicules de service sérigraphiés est strictement interdit. L'employé(e) doit être titulaire d'un permis de conduire valide. De plus, toute contravention reçue lors de l'utilisation de ces véhicules sera intégralement à la charge de l'employé(e).",
      ],
    },
    {
      heading: "Article 8 - Horaires & Disponibilités",
      paragraphs: [],
      bullets: [
        "Présence souhaitée lors des événements organisés par l'entreprise",
        "Minimum de présence hebdomadaire : 14h",
      ],
    },
    {
      heading: "Article 9 - Clause de confidentialité",
      paragraphs: [
        "L'employé(e) s'engage à observer la discrétion la plus stricte sur les informations se rapportant aux activités de la société auxquelles il aura accès à l'occasion et dans le cadre de ses fonctions.",
        "L'employé(e) s'engage également à ne divulguer, en aucun cas sauf avec permission, des informations sur la vie personnelle et professionnelle des employés et des cadres de l'entreprise. Cela inclut les adresses, numéros de téléphone, courriers électroniques, informations financières, affaires personnelles, et toute autre information sensible ou privée, pendant la durée de son service et après l'avoir quitté, y compris après la rupture éventuelle de l'engagement contractuel présent, sur tout ce qui a été appris ou communiqué.",
      ],
    },
    {
      heading: "Article 10 - Obligation de non-concurrence",
      paragraphs: [
        "Pendant la durée du présent contrat, l'employé(e) s'engage à ne participer, sous quelque forme que ce soit, à aucune activité susceptible de concurrencer tout ou partie des activités de la société qui emploie l'employé(e).",
      ],
    },
    {
      heading: "Article 11 - Résiliation, Démission & Licenciement",
      paragraphs: [
        "En cas de résiliation – démission ou de licenciement inclus – chacune des parties peut mettre fin au contrat à tout moment avec un préavis de 7 jours, notifié par écrit de la part de l'employé(e) ou du/de la patron(ne) selon l'objet de la résiliation. Cette lettre sera vérifiée par un avocat agréé.",
      ],
    },
    {
      heading: "Article 12 - Rupture du contrat",
      paragraphs: ["Si le contrat est un contrat à durée indéterminée, il peut être rompu pour les motifs suivants :"],
      bullets: [
        "Condamnation de l'employé pour un crime.",
        "Non-respect du règlement intérieur.",
        "Réduction de personnel pour raison économique.",
        "Absence de prise de service / travail pendant plus de 2 semaines non prévenues.",
        "Absence de prise de service / travail pendant plus de 3 semaines, même prévenu.",
        "Absence de visite médicale pendant une période de 2 semaines.",
        "Délits au sein de l'entreprise.",
      ],
    },
    {
      heading: "Article 13 - Litiges",
      paragraphs: [
        "Tout litige relatif à l'interprétation ou l'exécution du présent contrat sera réglé à l'amiable entre les parties. Sauf cas contraire, où la partie ayant créé le litige sera amenée en justice.",
      ],
    },
    {
      heading: "Article 14 - Règlement intérieur",
      paragraphs: ["Le règlement intérieur suivant a été mis en place par l'entreprise et se doit d'être respecté :"],
    },
    {
      paragraphs: [
        "En ayant lu et pris connaissance de ce contrat, l'employé(e) s'engage officiellement (après avoir signé) à respecter les clauses, conditions générales et à travailler dûment selon les consignes données.",
        `Fait à Paleto Bay, San Andréas, le ${fmtDate(c.date_signature)}`,
      ],
    },
  ];
}

/**
 * Avenant (amendement) — document court référençant le contrat d'origine,
 * pour un changement de grade / rémunération.
 */
export function buildAvenant(c: ContratChamps, numero: number): ContractSection[] {
  return [
    {
      paragraphs: [
        `Avenant n°${numero} au contrat de travail de ${val(c.nom_prenom)}`,
        `Entre l'entreprise Paleto Garage, représentée par ${REPRESENTANTS}, et l'employé(e) ${val(c.nom_prenom)}.`,
      ],
    },
    {
      heading: "Objet de l'avenant",
      paragraphs: [
        `Suite à un changement de grade, l'employé(e) occupe désormais le poste de ${val(c.grade_nom)}.`,
        `À ce titre, l'employé(e) percevra désormais ${c.salaire_texte}, selon les mêmes modalités de versement que le contrat initial.`,
        "Toutes les autres clauses du contrat de travail initial demeurent inchangées et continuent de s'appliquer.",
      ],
    },
    {
      paragraphs: [`Fait à Paleto Bay, San Andréas, le ${fmtDate(c.date_signature)}`],
    },
  ];
}
