# -*- coding: utf-8 -*-
"""
Harmonisation des noms de moniteurs avec IA / Fuzzy Matching
=============================================================

Ce script analyse les noms de moniteurs dans les données ODK,
détecte les variations d'orthographe pour un même moniteur,
et propose une harmonisation automatique.

Exemple : "Jean Mbembo", "Jean Mbebo", "J. Mbembo" → "Jean Mbembo"

Utilisation sur Google Colab ou en local :
  python scripts/harmonize-monitors.py
"""

import json
import re
from collections import defaultdict
from difflib import SequenceMatcher
import unicodedata

# =============================================================================
# CONFIGURATION
# =============================================================================

ODK_TOKEN = "4df4f5e1aa19b0c47f872fb0f2cd0b482cdf45f8"
ODK_BASE_URL = "https://api.whonghub.org"
HOUSEHOLD_FORM_ID = 16244
OUTSIDE_FORM_ID = 4499

# Seuil de similarité pour considérer deux noms comme identiques
# 0.85 = assez strict, 0.75 = plus permissif
SIMILARITY_THRESHOLD = 0.82

# =============================================================================
# FONCTIONS UTILITAIRES
# =============================================================================

def fetch_odk_data(form_id: int) -> list:
    """Récupère les soumissions depuis l'API ODK"""
    import requests

    url = f"{ODK_BASE_URL}/api/v1/data/{form_id}.json"
    headers = {
        'Authorization': f'Token {ODK_TOKEN}',
        'Accept': 'application/json'
    }
    try:
        response = requests.get(url, headers=headers, timeout=30)
        response.raise_for_status()
        return response.json()
    except Exception as e:
        print(f"⚠️ Erreur API: {e}")
        return []


def normalize_text(text: str) -> str:
    """
    Normalise un texte pour la comparaison :
    - Minuscules
    - Suppression des accents
    - Suppression des caractères spéciaux
    - Espaces multiples réduits à un seul
    """
    if not text:
        return ""

    # Minuscules et suppression des accents
    text = text.lower()
    text = unicodedata.normalize('NFD', text)
    text = ''.join(c for c in text if unicodedata.category(c) != 'Mn')

    # Suppression des caractères spéciaux (garder lettres, chiffres, espaces)
    text = re.sub(r'[^a-z0-9\s]', '', text)

    # Réduction des espaces multiples
    text = re.sub(r'\s+', ' ', text).strip()

    return text


def similarity(a: str, b: str) -> float:
    """
    Calcule le ratio de similarité entre deux chaînes (0 à 1).
    Utilise SequenceMatcher de difflib (algorithme Ratcliff/Obershelp).
    """
    a_norm = normalize_text(a)
    b_norm = normalize_text(b)

    if not a_norm or not b_norm:
        return 0.0

    return SequenceMatcher(None, a_norm, b_norm).ratio()


def extract_monitors(submissions: list, field_candidates: list) -> dict:
    """
    Extrait tous les noms de moniteurs depuis les soumissions.
    Retourne un dict {nom_brut: count}.
    """
    monitors = defaultdict(int)

    for sub in submissions:
        name = None
        for field in field_candidates:
            if field in sub and sub[field]:
                name = sub[field]
                break

        if name:
            monitors[name.strip()] += 1

    return dict(monitors)


def find_similar_names(monitors: dict, threshold: float = 0.82) -> list:
    """
    Trouve les paires de noms similaires dans la liste des moniteurs.
    Retourne une liste de clusters de noms similaires.
    """
    names = list(monitors.keys())
    clusters = []  # Liste de sets de noms similaires
    processed = set()

    for i, name1 in enumerate(names):
        if name1 in processed:
            continue

        cluster = {name1}

        for j, name2 in enumerate(names[i+1:], start=i+1):
            if name2 in processed:
                continue

            sim = similarity(name1, name2)

            if sim >= threshold:
                cluster.add(name2)
                processed.add(name2)

        if len(cluster) > 1:
            clusters.append(cluster)

        processed.add(name1)

    return clusters


def choose_canonical_name(cluster: set, monitors: dict) -> str:
    """
    Choisit le nom canonique pour un cluster de variations.
    Stratégie : le nom le plus fréquent, puis le plus long (plus complet).
    """
    if not cluster:
        return ""

    # Trier par fréquence décroissante, puis par longueur décroissante
    sorted_names = sorted(
        cluster,
        key=lambda n: (monitors.get(n, 0), len(n)),
        reverse=True
    )

    return sorted_names[0]


def generate_mapping(monitors: dict, clusters: list) -> dict:
    """
    Génère un mapping {nom_variante: nom_canonique}.
    """
    mapping = {}

    for cluster in clusters:
        canonical = choose_canonical_name(cluster, monitors)
        for name in cluster:
            if name != canonical:
                mapping[name] = canonical

    return mapping


def apply_mapping_to_data(submissions: list, mapping: dict, field: str) -> list:
    """
    Applique le mapping aux soumissions pour harmoniser les noms.
    """
    updated = 0

    for sub in submissions:
        if field in sub and sub[field]:
            old_name = sub[field]
            new_name = mapping.get(old_name, old_name)
            if new_name != old_name:
                sub[field] = new_name
                updated += 1

    print(f"   → {updated} soumissions mises à jour")
    return submissions


# =============================================================================
# SCRIPT PRINCIPAL
# =============================================================================

def main():
    print("=" * 70)
    print("🔍 HARMONISATION DES NOMS DE MONITEURS")
    print("=" * 70)

    # Champ ODK pour le nom du moniteur
    MONITOR_FIELD = "Name_of_Monitor"  # À ajuster selon le formulaire

    # Récupération des données
    print("\n📥 Récupération des données...")

    print("   Formulaire Ménage (16244)...")
    household_data = fetch_odk_data(HOUSEHOLD_FORM_ID)
    print(f"   → {len(household_data)} soumissions")

    print("   Formulaire Hors-ménage (4499)...")
    outside_data = fetch_odk_data(OUTSIDE_FORM_ID)
    print(f"   → {len(outside_data)} soumissions")

    all_data = household_data + outside_data
    print(f"\n   Total: {len(all_data)} soumissions")

    # Extraction des moniteurs
    print("\n📋 Extraction des noms de moniteurs...")

    field_candidates = [
        "Name_of_Monitor",
        "name_of_monitor",
        "Monitor_Name",
        "monitor_name",
        "monitorName"
    ]

    monitors = extract_monitors(all_data, field_candidates)

    print(f"   → {len(monitors)} noms uniques trouvés")

    # Affichage des top 20
    print("\n   Top 20 des moniteurs (par fréquence):")
    sorted_monitors = sorted(monitors.items(), key=lambda x: x[1], reverse=True)
    for i, (name, count) in enumerate(sorted_monitors[:20], 1):
        print(f"      {i:2}. {name:40} ({count:4} soumissions)")

    # Détection des similarités
    print(f"\n🔎 Recherche de noms similaires (seuil: {SIMILARITY_THRESHOLD})...")

    clusters = find_similar_names(monitors, threshold=SIMILARITY_THRESHOLD)

    print(f"   → {len(clusters)} groupes de variations détectés")

    if not clusters:
        print("\n✅ Aucune variation détectée. Les noms semblent déjà harmonisés.")
        return

    # Affichage des clusters
    print("\n📊 Groupes de variations détectés:")
    print("-" * 70)

    for i, cluster in enumerate(clusters, 1):
        canonical = choose_canonical_name(cluster, monitors)
        sorted_cluster = sorted(cluster, key=lambda n: monitors.get(n, 0), reverse=True)

        print(f"\n   Groupe {i}:")
        print(f"   🎯 Nom canonique: {canonical}")
        print(f"   Variantes:")
        for name in sorted_cluster:
            if name != canonical:
                print(f"      • {name} ({monitors.get(name, 0)} occurrences)")

    # Génération du mapping
    print("\n🔧 Génération du mapping d'harmonisation...")

    mapping = generate_mapping(monitors, clusters)

    print(f"   → {len(mapping)} variantes à harmoniser")

    # Sauvegarde du mapping en JSON
    mapping_file = "monitor_mapping.json"
    with open(mapping_file, "w", encoding="utf-8") as f:
        json.dump(mapping, f, ensure_ascii=False, indent=2)

    print(f"   → Mapping sauvegardé: {mapping_file}")

    # Application du mapping aux données
    print("\n💾 Application de l'harmonisation aux données...")

    household_updated = apply_mapping_to_data(household_data, mapping, MONITOR_FIELD)
    outside_updated = apply_mapping_to_data(outside_data, mapping, MONITOR_FIELD)

    # Sauvegarde des données harmonisées
    output_file = "data_harmonized.json"
    with open(output_file, "w", encoding="utf-8") as f:
        json.dump({
            "household": household_updated,
            "outside": outside_updated,
            "mapping": mapping,
            "summary": {
                "total_submissions": len(all_data),
                "unique_monitors_before": len(monitors),
                "unique_monitors_after": len(set(monitors.values()) - set(mapping.keys())),
                "variants_harmonized": len(mapping),
            }
        }, f, ensure_ascii=False, indent=2)

    print(f"\n📁 Données harmonisées sauvegardées: {output_file}")

    # Résumé
    print("\n" + "=" * 70)
    print("📊 RÉSUMÉ")
    print("=" * 70)
    print(f"   Moniteurs avant harmonisation: {len(monitors)}")
    print(f"   Moniteurs après harmonisation: {len(monitors) - len(mapping)}")
    print(f"   Variantes harmonisées: {len(mapping)}")
    print(f"   Soumissions mises à jour: {sum(1 for s in all_data if s.get(MONITOR_FIELD) in mapping)}")

    print("\n✅ Terminé !")
    print("\n💡 Pour intégrer dans le dashboard:")
    print("   1. Utiliser le fichier monitor_mapping.json dans parse-submission.ts")
    print("   2. Ou importer data_harmonized.json directement")


if __name__ == "__main__":
    main()
