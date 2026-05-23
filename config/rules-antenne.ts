/**
 * Correspondance ZS -> Antenne, par Province.
 * Source : rules_antenne_json.pdf fourni par le métier.
 *
 * Clé : Province (libellé canonique)
 * Valeur : map ZS -> Antenne
 *
 * Les libellés ZS sont CANONIQUES (casse initiale comme saisis dans le PDF).
 * Au moment de l'ETL, on les matche en clé normalisée (UPPER+strip).
 */

export const RULES_ANTENNE: Record<string, Record<string, string>> = {
  "Bas Uele": {
    Aketi: "Buta", Ango: "Buta", Bili: "Buta", Bondo: "Buta", Buta: "Buta",
    Dingila: "Buta", Likati: "Buta", Monga: "Buta", Poko: "Buta",
    Titule: "Buta", Viadana: "Buta", Ganga: "Buta",
  },
  Equateur: {
    Basankusu: "Mbandaka", Bikoro: "Mbandaka", Bolenge: "Mbandaka",
    Bolomba: "Mbandaka", Bomongo: "Mbandaka", Djombo: "Mbandaka",
    Iboko: "Mbandaka", Ingende: "Mbandaka", Irebu: "Mbandaka",
    "Lilanga Bobangi": "Mbandaka", Lolanga: "Mbandaka", Mampoko: "Mbandaka",
    Lotumbe: "Mbandaka", Lukolela: "Mbandaka", Makanza: "Mbandaka",
    Mbandaka: "Mbandaka", Monieka: "Mbandaka", Ntondo: "Mbandaka",
    Wangata: "Mbandaka",
  },
  Ituri: {
    Adi: "Aru", Adja: "Aru", Angumu: "Aru", Ariwara: "Aru", Aru: "Aru",
    Aungba: "Aru", Biringi: "Aru", Gety: "Aru", Kambala: "Aru", Laybo: "Aru",
    Logo: "Aru", Mahagi: "Aru", Nyarambe: "Aru", Rimba: "Aru",
    Bambu: "Bunia", Boga: "Bunia", Bunia: "Bunia", Damas: "Bunia",
    Drodro: "Bunia", Fataki: "Bunia", Jiba: "Bunia", Kilo: "Bunia",
    Komanda: "Bunia", Linga: "Bunia", Lita: "Bunia", Lolwa: "Bunia",
    Mambasa: "Bunia", Mandima: "Bunia", Mangala: "Bunia", Mongbwalu: "Bunia",
    "Nia Nia": "Bunia", Nizi: "Bunia", Nyankunde: "Bunia", Rethy: "Bunia",
    Rwampara: "Bunia", Tchomia: "Bunia",
  },
  Kwilu: {
    Bagata: "Bandundu", Bandundu: "Bandundu", Djuma: "Bandundu",
    Kikongo: "Bandundu", Sia: "Bandundu", Vanga: "Bandundu",
    Bulungu: "Kikwit", Gungu: "Kikwit", Idiofa: "Kikwit", Ipamu: "Kikwit",
    "Kikwit Nord": "Kikwit", "Kikwit Sud": "Kikwit", Kimputu: "Kikwit",
    Kingandu: "Kikwit", Koshibanda: "Kikwit", Lusanga: "Kikwit",
    "Masi Manimba": "Kikwit", Moanza: "Kikwit", Mokala: "Kikwit",
    Mosango: "Kikwit", Mukedi: "Kikwit", Mungindu: "Kikwit",
    "Pay Kongila": "Kikwit", "Yasa Bonga": "Kikwit",
  },
  Tshuapa: {
    Befale: "Boende", Boende: "Boende", Lingomo: "Boende",
    Mompono: "Boende", Monkoto: "Boende", Wema: "Boende",
    Bokungu: "Bokungu", Busanga: "Bokungu", Djolu: "Bokungu",
    Ikela: "Bokungu", Mondombe: "Bokungu", Yalifafu: "Bokungu",
  },
  "Kongo Central": {
    Boma: "Boma", "Boma Bungu": "Boma", Kangu: "Boma", Kinkonzi: "Boma",
    Kitona: "Boma", Kizu: "Boma", Kuimba: "Boma", Lukula: "Boma",
    Muanda: "Boma", Tshela: "Boma", Vaku: "Boma",
    Inga: "Matadi", Kibunzi: "Matadi", Luozi: "Matadi", Mangembo: "Matadi",
    Matadi: "Matadi", "Nsona Mpangu": "Matadi", Nzanza: "Matadi",
    "Seke Banza": "Matadi",
    "Boko Kivulu": "Mbanza Ngungu", "Gombe Matadi": "Mbanza Ngungu",
    Kimpangu: "Mbanza Ngungu", Kimpese: "Mbanza Ngungu",
    Kimvula: "Mbanza Ngungu", Kisantu: "Mbanza Ngungu",
    "Kwilu Ngongo": "Mbanza Ngungu", Massa: "Mbanza Ngungu",
    "Mbanza Ngungu": "Mbanza Ngungu", Ngidinga: "Mbanza Ngungu",
    Nselo: "Mbanza Ngungu", "Sona Bata": "Mbanza Ngungu",
  },
  "Sud Kivu": {
    Bagira: "Bukavu", Bunyakiri: "Bukavu", Ibanda: "Bukavu",
    Idjwi: "Bukavu", Kabare: "Bukavu", Kadutu: "Bukavu", Kalehe: "Bukavu",
    Kalole: "Bukavu", Kalonge: "Bukavu", Kamituga: "Bukavu",
    Kaniola: "Bukavu", Katana: "Bukavu", Kaziba: "Bukavu",
    Kitutu: "Bukavu", Lulingu: "Bukavu", Minova: "Bukavu",
    "Miti Murhesa": "Bukavu", Mubumbano: "Bukavu", Mulungu: "Bukavu",
    Mwana: "Bukavu", Mwenga: "Bukavu", Nyangezi: "Bukavu",
    Nyantende: "Bukavu", Shabunda: "Bukavu", Walungu: "Bukavu",
    Fizi: "Uvira", "Haut Plateau": "Uvira", Itombwe: "Uvira",
    "Kimbi Lulenge": "Uvira", Lemera: "Uvira", Minembwe: "Uvira",
    Nundu: "Uvira", Ruzizi: "Uvira", Uvira: "Uvira",
  },
  Mongala: {
    Bumba: "Bumba", Lolo: "Bumba", Yamaluka: "Bumba", Yambuku: "Bumba",
    Yamongili: "Bumba",
    Binga: "Lisala", Bongandanga: "Lisala", "Boso Manzi": "Lisala",
    "Boso Mondanda": "Lisala", Bosondjo: "Lisala", Lisala: "Lisala",
    Pimu: "Lisala",
  },
  "Nord Kivu": {
    Alimbongo: "Butembo", Beni: "Butembo", Biena: "Butembo",
    Butembo: "Butembo", Kalunguta: "Butembo", Kamango: "Butembo",
    Katwa: "Butembo", Kayna: "Butembo", Kyondo: "Butembo",
    Lubero: "Butembo", Mabalako: "Butembo", Manguredjipa: "Butembo",
    Masereka: "Butembo", Musienene: "Butembo", Mutwanga: "Butembo",
    Oicha: "Butembo", Vuhovi: "Butembo",
    Bambo: "Goma", Binza: "Goma", Birambizo: "Goma", Goma: "Goma",
    Itebero: "Goma", Karisimbi: "Goma", Katoyi: "Goma", Kibirizi: "Goma",
    Kibua: "Goma", Kirotshe: "Goma", Masisi: "Goma", Mweso: "Goma",
    Nyiragongo: "Goma", Pinga: "Goma", Rutshuru: "Goma",
    Rwanguba: "Goma", Walikale: "Goma",
  },
  "Nord Ubangi": {
    Abuzi: "Gbadolite", Bili: "Gbadolite", Bosobolo: "Gbadolite",
    Businga: "Gbadolite", Gbadolite: "Gbadolite", Karawa: "Gbadolite",
    Loko: "Gbadolite", "Mobayi Mbongo": "Gbadolite", Wapinda: "Gbadolite",
    Wasolo: "Gbadolite", Yakoma: "Gbadolite",
  },
  "Sud Ubangi": {
    Bangabola: "Gemena", Bogosenubea: "Gemena", Bokonzi: "Gemena",
    Bominenge: "Gemena", Boto: "Gemena", Budjala: "Gemena",
    Bulu: "Gemena", Bwamanda: "Gemena", Gemena: "Gemena",
    Kungu: "Gemena", Libenge: "Gemena", Mawuya: "Gemena",
    Mbaya: "Gemena", Ndage: "Gemena", Tandala: "Gemena", Zongo: "Gemena",
  },
  Maindombe: {
    "Banzow Moke": "Inongo", Bokoro: "Inongo", Bolobo: "Inongo",
    Bosobe: "Inongo", Inongo: "Inongo", Kiri: "Inongo",
    Kwamouth: "Inongo", Mimia: "Inongo", Mushie: "Inongo",
    Nioki: "Inongo", Ntandembelo: "Inongo", Oshwe: "Inongo",
    Pendjwa: "Inongo", Yumbi: "Inongo",
  },
  "Haut Uele": {
    "Boma Mangbetu": "Isiro", Doruma: "Isiro", Dungu: "Isiro",
    Isiro: "Isiro", Niangara: "Isiro", Pawa: "Isiro", Rungu: "Isiro",
    Wamba: "Isiro",
    Aba: "Watsa", Faradje: "Watsa", Gombari: "Watsa", Makoro: "Watsa",
    Watsa: "Watsa",
  },
  Tanganyika: {
    Ankoro: "Kabalo", Kabalo: "Kabalo", Kiambi: "Kabalo", Kongolo: "Kabalo",
    Manono: "Kabalo", Mbulula: "Kabalo",
    Kalemie: "Kalemie", Kansimba: "Kalemie", Moba: "Kalemie",
    Nyemba: "Kalemie", Nyunzu: "Kalemie",
  },
  Lomami: {
    Kabinda: "Kabinda", "Kalambayi Kabanga": "Kabinda",
    "Kalonda Est": "Kabinda", Kamana: "Kabinda", Lubao: "Kabinda",
    "Ludimbi Lukula": "Kabinda", Mulumba: "Kabinda",
    Ngandajika: "Kabinda", Tshofa: "Kabinda",
    Kalenda: "Mweneditu", Kamiji: "Mweneditu", "Kanda Kanda": "Mweneditu",
    Luputa: "Mweneditu", Makota: "Mweneditu", Mweneditu: "Mweneditu",
    Wikong: "Mweneditu",
  },
  "Haut Lomami": {
    Bukama: "Kabondo Dianda", Butumba: "Kabondo Dianda",
    "Kabondo Dianda": "Kabondo Dianda", Kinkondja: "Kabondo Dianda",
    Lwamba: "Kabondo Dianda", "Malemba Nkulu": "Kabondo Dianda",
    Mukanga: "Kabondo Dianda", Mulongo: "Kabondo Dianda",
    Baka: "Kamina", Kabongo: "Kamina", Kamina: "Kamina",
    Kaniama: "Kamina", Kayamba: "Kamina", Kinda: "Kamina",
    Kitenge: "Kamina", Songa: "Kamina",
  },
  Kwango: {
    Kahemba: "Kahemba", Kajiji: "Kahemba", Kisanji: "Kahemba",
    Panzi: "Kahemba", Tembo: "Kahemba",
    Boko: "Kenge", Feshi: "Kenge", "Kasongo Lunda": "Kenge",
    Kenge: "Kenge", Kimbao: "Kenge", Kitenda: "Kenge",
    "Mwela Lembwa": "Kenge", Popokabaka: "Kenge", "Wamba Lwadi": "Kenge",
  },
  "Kasai Central": {
    "Bena Leka": "Kananga", "Bena Tshadi": "Kananga", Bilomba: "Kananga",
    Bobozo: "Kananga", Bunkonde: "Kananga", Demba: "Kananga",
    Dibaya: "Kananga", Kananga: "Kananga", Katende: "Kananga",
    Katoka: "Kananga", Lubondaie: "Kananga", Lubunga: "Kananga",
    Lukonga: "Kananga", Mikalayi: "Kananga", Muetshi: "Kananga",
    Mutoto: "Kananga", Ndekesha: "Kananga", Ndesha: "Kananga",
    Tshikaji: "Kananga", Tshikula: "Kananga",
    Kalomba: "Luiza", Luambo: "Luiza", Luiza: "Luiza",
    Masuika: "Luiza", Tshibala: "Luiza", Yangala: "Luiza",
  },
  Maniema: {
    Kabambare: "Kasongo", Kampene: "Kasongo", Kasongo: "Kasongo",
    Kibombo: "Kasongo", Kunda: "Kasongo", Lusangi: "Kasongo",
    Saramabila: "Kasongo", Samba: "Kasongo", Tunda: "Kasongo",
    Alunguli: "Kindu", Ferekeni: "Kindu", Kailo: "Kindu",
    Kalima: "Kindu", Kindu: "Kindu", Lubutu: "Kindu",
    Obokote: "Kindu", Pangi: "Kindu", Punia: "Kindu",
  },
  Kinshasa: {
    Bumbu: "Kin Centre", "Kalamu 1": "Kin Centre", "Kalamu 2": "Kin Centre",
    "Kasa Vubu": "Kin Centre", Kingabwa: "Kin Centre", Kisenso: "Kin Centre",
    Lemba: "Kin Centre", Limete: "Kin Centre", Makala: "Kin Centre",
    Matete: "Kin Centre", Ngaba: "Kin Centre", "Ngiri Ngiri": "Kin Centre",
    Biyela: "Kin Est", Kikimi: "Kin Est", Kimbanseke: "Kin Est",
    Kingasani: "Kin Est", "Maluku 1": "Kin Est", "Maluku 2": "Kin Est",
    "Masina 1": "Kin Est", "Masina 2": "Kin Est", Ndjili: "Kin Est",
    Nsele: "Kin Est",
    Bandalungwa: "Kin Ouest", Barumbu: "Kin Ouest",
    "Binza Meteo": "Kin Ouest", "Binza Ozone": "Kin Ouest",
    Gombe: "Kin Ouest", Kinshasa: "Kin Ouest", Kintambo: "Kin Ouest",
    Kokolo: "Kin Ouest", Lingwala: "Kin Ouest",
    "Mont Ngafula 1": "Kin Ouest", "Mont Ngafula 2": "Kin Ouest",
    Police: "Kin Ouest", Selembao: "Kin Ouest",
  },
  Tshopo: {
    Bafwagbogbo: "Kisangani", Bafwasende: "Kisangani", Banalia: "Kisangani",
    Bengamisa: "Kisangani", Kabondo: "Kisangani", Lowa: "Kisangani",
    Lubunga: "Kisangani", "Makiso Kisangani": "Kisangani",
    Mangobo: "Kisangani", Opala: "Kisangani", Opienge: "Kisangani",
    Tshopo: "Kisangani", Ubundu: "Kisangani", Wanierukula: "Kisangani",
    Yahisuli: "Kisangani", Yakusu: "Kisangani", Yaleko: "Kisangani",
    Basali: "Lokutu", Basoko: "Lokutu", Isangi: "Lokutu",
    Yabaondo: "Lokutu", Yahuma: "Lokutu", Yalimbongo: "Lokutu",
  },
  Lualaba: {
    Dilolo: "Kisenge", Kafakumba: "Kisenge", Kalamba: "Kisenge",
    Kapanga: "Kisenge", Kasaji: "Kisenge", Sandoa: "Kisenge",
    Bunkeya: "Kolwezi", Dilala: "Kolwezi", Fungurume: "Kolwezi",
    Kanzenze: "Kolwezi", Lualaba: "Kolwezi", Lubudi: "Kolwezi",
    Manika: "Kolwezi", Mutshatsha: "Kolwezi",
  },
  "Haut Katanga": {
    Kambove: "Likasi", Kapolowe: "Likasi", Kikula: "Likasi",
    "Kilela Balanda": "Likasi", Likasi: "Likasi", Mitwaba: "Likasi",
    "Mufunga Sampwe": "Likasi", Panda: "Likasi",
    Kafubu: "Lubumbashi", Kamalondo: "Lubumbashi",
    Kampemba: "Lubumbashi", Kasenga: "Lubumbashi", Kashobwe: "Lubumbashi",
    Katuba: "Lubumbashi", Kenya: "Lubumbashi", Kilwa: "Lubumbashi",
    Kipushi: "Lubumbashi", Kisanga: "Lubumbashi", Kowe: "Lubumbashi",
    Lubumbashi: "Lubumbashi", Lukafu: "Lubumbashi", Mumbunda: "Lubumbashi",
    Pweto: "Lubumbashi", Ruashi: "Lubumbashi", Sakania: "Lubumbashi",
    Tshamilemba: "Lubumbashi", Vangu: "Lubumbashi",
  },
  Sankuru: {
    "Bena Dibele": "Lodja", Dikungu: "Lodja", "Djalo Ndjeka": "Lodja",
    "Katako Kombe": "Lodja", Kole: "Lodja", Lodja: "Lodja",
    Lomela: "Lodja", Lusambo: "Lodja", Minga: "Lodja",
    Omendjadi: "Lodja", Ototo: "Lodja", "Pania Mutombo": "Lodja",
    "Tshudi Loto": "Lodja", Tshumbe: "Lodja", "Vanga Kete": "Lodja",
    "Wembo Nyama": "Lodja",
  },
  "Kasai Oriental": {
    Bibanga: "Mbuji Mayi", Bipemba: "Mbuji Mayi", Bonzola: "Mbuji Mayi",
    Cilundu: "Mbuji Mayi", Citenge: "Mbuji Mayi", Dibindi: "Mbuji Mayi",
    Diulu: "Mbuji Mayi", "Kabeya Kamwanga": "Mbuji Mayi",
    Kansele: "Mbuji Mayi", Kasansa: "Mbuji Mayi", Lubilanji: "Mbuji Mayi",
    Lukelenge: "Mbuji Mayi", Miabi: "Mbuji Mayi", Mpokolo: "Mbuji Mayi",
    Mukumbi: "Mbuji Mayi", Muya: "Mbuji Mayi", Nzaba: "Mbuji Mayi",
    Tshilenge: "Mbuji Mayi", Tshishimbi: "Mbuji Mayi",
  },
  Kasai: {
    Bulape: "Mweka", Dekese: "Mweka", Ilebo: "Mweka", Kakenge: "Mweka",
    Luebo: "Mweka", Mikope: "Mweka", Mushenge: "Mweka", Mweka: "Mweka",
    "Banga Lubaka": "Tshikapa", "Kalonda Ouest": "Tshikapa",
    Kamonia: "Tshikapa", Kamwesha: "Tshikapa", Kanzala: "Tshikapa",
    Kitangwa: "Tshikapa", Mutena: "Tshikapa", "Ndjoko Mpunda": "Tshikapa",
    Nyanga: "Tshikapa", Tshikapa: "Tshikapa",
  },
};

/**
 * Résolveur ZS -> Antenne pour une province donnée.
 * Retourne null si pas de match.
 */
export function resolveAntenne(province: string | null, zs: string | null): string | null {
  if (!province || !zs) return null;
  const zsMap = RULES_ANTENNE[province];
  if (!zsMap) return null;
  const normZs = zs.trim().toLowerCase();
  for (const [canonical, antenne] of Object.entries(zsMap)) {
    if (canonical.trim().toLowerCase() === normZs) return antenne;
  }
  return null;
}

/** Liste complète des antennes (unique, triée). */
export function listAntennes(): string[] {
  const set = new Set<string>();
  for (const p of Object.values(RULES_ANTENNE)) {
    for (const a of Object.values(p)) set.add(a);
  }
  return Array.from(set).sort();
}

/** Liste des ZS canoniques pour une province. */
export function listZsForProvince(province: string): string[] {
  return Object.keys(RULES_ANTENNE[province] ?? {}).sort();
}
