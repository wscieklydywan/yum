export const LEGAL_EMAIL = 'biuro@yummypolska.pl'

export const COMPANY = {
  name: 'Yummy S.C. Marcin Krystosiak, Aleksandra Brzoza',
  nip: '6423234493',
  address: 'ul. Gen. Władysława Andersa 7, 44-270 Rybnik',
  website: 'https://www.yummyrybnik.pl',
} as const

export type LegalSection = {
  heading: string
  paragraphs?: string[]
  list?: string[]
}

export type LegalDocument = {
  slug: LegalSlug
  title: string
  tabLabel: string
  updatedAt: string
  intro?: string
  sections: LegalSection[]
}

export type LegalSlug = 'regulamin' | 'yummy-club' | 'polityka-prywatnosci' | 'rodo'

const regulamin: LegalDocument = {
  slug: 'regulamin',
  title: 'Regulamin składania zamówień',
  tabLabel: 'Regulamin',
  updatedAt: '20.10.2026',
  intro:
    'Regulamin określa zasady składania zamówień w restauracji Yummy Rybnik przez stronę internetową, kiosk samoobsługowy w lokalu oraz przy barze.',
  sections: [
    {
      heading: '§ 1. Sprzedawca',
      paragraphs: [
        `Sprzedawcą i usługodawcą jest ${COMPANY.name}, NIP ${COMPANY.nip}, ${COMPANY.address} (dalej: „Yummy”).`,
        `Kontakt: e-mail ${LEGAL_EMAIL}, osobiście w lokalu lub telefonicznie pod numerem podanym na stronie.`,
      ],
    },
    {
      heading: '§ 2. Definicje',
      list: [
        `Serwis – strona internetowa ${COMPANY.website} wraz z podstronami, w tym Yummy Club.`,
        'Kiosk – samoobsługowy ekran w lokalu Yummy, na którym można złożyć zamówienie na miejscu.',
        'Klient – osoba fizyczna, osoba prawna lub jednostka organizacyjna składająca zamówienie. Osoba niepełnoletnia może składać zamówienia za zgodą opiekuna prawnego.',
        'Konsument – Klient będący osobą fizyczną, składający zamówienie niezwiązane bezpośrednio z jego działalnością gospodarczą lub zawodową.',
        'Dania – dania, przekąski, napoje i inne produkty z aktualnego menu Yummy.',
        'Zamówienie – oświadczenie woli Klienta określające rodzaj i liczbę Dań oraz sposób odbioru.',
      ],
    },
    {
      heading: '§ 3. Wymagania techniczne',
      paragraphs: [
        'Do złożenia zamówienia przez Serwis potrzebne są: urządzenie z dostępem do Internetu, aktualna przeglądarka z włączoną obsługą plików cookies i JavaScript oraz numer telefonu. Kiosk w lokalu nie wymaga od Klienta żadnego sprzętu.',
      ],
    },
    {
      heading: '§ 4. Składanie zamówień',
      list: [
        'Menu prezentowane w Serwisie i na Kiosku nie jest ofertą w rozumieniu Kodeksu cywilnego, lecz zaproszeniem do złożenia oferty.',
        'Ceny podawane są w złotych polskich i zawierają podatek VAT.',
        'Zamówienie można zrealizować jako: dostawę pod wskazany adres (w obszarze dostaw określonym w Serwisie), odbiór osobisty, posiłek na miejscu lub zamówienie z Kiosku.',
        'W Serwisie Klient podaje dane niezbędne do realizacji zamówienia: imię, numer telefonu, a przy dostawie – adres. Na Kiosku podanie danych nie jest wymagane.',
        'Do momentu kliknięcia przycisku „Zamawiam” Klient może dowolnie zmieniać zawartość koszyka i podane dane.',
        'Kliknięcie „Zamawiam” oznacza złożenie zamówienia i akceptację niniejszego Regulaminu oraz Polityki prywatności. Umowa zostaje zawarta z chwilą przyjęcia zamówienia przez Yummy, o czym Klient jest informowany komunikatem w Serwisie lub numerem zamówienia na Kiosku.',
        'Yummy może odmówić realizacji zamówienia, jeżeli adres dostawy jest poza obszarem dostaw, danie jest niedostępne lub dane podane przez Klienta budzą uzasadnione wątpliwości – Klient zostanie o tym poinformowany.',
        'Czas realizacji podany w Serwisie jest szacunkowy i może się wydłużyć w godzinach dużego ruchu.',
      ],
    },
    {
      heading: '§ 5. Płatności',
      list: [
        'Płatności dokonuje się przy odbiorze zamówienia – gotówką lub kartą (u dostawcy, przy barze lub w lokalu).',
        'Zamówienia złożone na Kiosku opłaca się przy barze, podając numer zamówienia wyświetlony na ekranie.',
        'Na życzenie Klienta wystawiamy paragon z NIP lub fakturę.',
      ],
    },
    {
      heading: '§ 6. Odstąpienie od umowy',
      list: [
        'Zgodnie z art. 38 ustawy o prawach konsumenta prawo odstąpienia od umowy zawartej na odległość nie przysługuje w przypadku Dań przygotowywanych na indywidualne zamówienie oraz produktów ulegających szybkiemu zepsuciu.',
        'Klient może anulować zamówienie bez podania przyczyny, dopóki jego przygotowanie nie zostało rozpoczęte – kontaktując się z lokalem telefonicznie lub osobiście.',
        'Produkty o trwałym charakterze (np. zamknięte napoje) mogą zostać zwrócone w niezmienionym stanie w terminie 14 dni. Zwrot płatności następuje tą samą metodą, której użył Klient.',
      ],
    },
    {
      heading: '§ 7. Reklamacje',
      list: [
        'Yummy odpowiada za zgodność Dań z umową na zasadach określonych w Kodeksie cywilnym i ustawie o prawach konsumenta.',
        'Niezgodność zamówienia najlepiej zgłosić od razu po odbiorze – w lokalu lub telefonicznie – abyśmy mogli szybko ją naprawić.',
        `Reklamację można też złożyć e-mailem na adres ${LEGAL_EMAIL} z tytułem „Reklamacja”, podając opis problemu, numer lub datę zamówienia oraz dane kontaktowe.`,
        'Reklamacje dotyczące działania Serwisu lub Kiosku zgłasza się w ten sam sposób.',
        'Reklamacje rozpatrujemy w terminie 14 dni od ich otrzymania. Odpowiedź przekazujemy w sposób, w jaki reklamacja została złożona, chyba że Klient wskaże inny.',
        'Konsument może skorzystać z pozasądowych sposobów rozpatrywania sporów, np. pomocy powiatowego (miejskiego) rzecznika konsumentów lub Wojewódzkiego Inspektoratu Inspekcji Handlowej.',
      ],
    },
    {
      heading: '§ 8. Obowiązki Klienta',
      list: [
        'Korzystanie z Serwisu i Kiosku zgodnie z prawem, Regulaminem i dobrymi obyczajami.',
        'Niepodawanie danych nieprawdziwych lub danych osób trzecich bez ich zgody.',
        'Niedostarczanie treści bezprawnych oraz niepodejmowanie działań zakłócających działanie Serwisu lub Kiosku.',
        'Treści Serwisu (w tym zdjęcia i opisy Dań) mogą być wykorzystywane wyłącznie do użytku osobistego.',
      ],
    },
    {
      heading: '§ 9. Postanowienia końcowe',
      list: [
        'Regulamin jest regulaminem, o którym mowa w art. 8 ustawy o świadczeniu usług drogą elektroniczną. Jest dostępny bezpłatnie w Serwisie i na Kiosku w formie umożliwiającej jego zapisanie i wydrukowanie.',
        'Yummy może zmienić Regulamin z ważnych przyczyn (prawnych, technicznych lub organizacyjnych). Zmiany wchodzą w życie po 14 dniach od ich opublikowania w Serwisie; do zamówień złożonych wcześniej stosuje się dotychczasową wersję.',
        'Językiem umowy jest język polski. W sprawach nieuregulowanych stosuje się przepisy prawa polskiego, w szczególności Kodeksu cywilnego, ustawy o prawach konsumenta oraz ustawy o świadczeniu usług drogą elektroniczną.',
        'Spory z Konsumentami rozstrzygają sądy właściwe według przepisów Kodeksu postępowania cywilnego, a z Klientami niebędącymi Konsumentami – sąd właściwy dla siedziby Yummy.',
        'Nieważność któregokolwiek postanowienia nie wpływa na ważność pozostałych.',
      ],
    },
  ],
}

const yummyClub: LegalDocument = {
  slug: 'yummy-club',
  title: 'Regulamin Yummy Club, promocji i kodów rabatowych',
  tabLabel: 'Yummy Club i rabaty',
  updatedAt: '20.10.2026',
  intro: 'Zasady programu lojalnościowego Yummy Club oraz korzystania z promocji i kodów rabatowych.',
  sections: [
    {
      heading: '§ 1. Organizator',
      paragraphs: [`Organizatorem programu Yummy Club oraz promocji jest ${COMPANY.name}, NIP ${COMPANY.nip}, ${COMPANY.address}.`],
    },
    {
      heading: '§ 2. Uczestnictwo w Yummy Club',
      list: [
        'Udział w Yummy Club jest bezpłatny i dobrowolny. Do programu można dołączyć, zakładając konto w Serwisie (e-mail i hasło lub konto Google / Apple) i przypisując do niego numer telefonu.',
        'Jedna osoba może posiadać jedno konto. Konto jest niezbywalne.',
        'Uczestnik może w każdej chwili zrezygnować z programu i zażądać usunięcia konta, pisząc na ' + LEGAL_EMAIL + '. Niewykorzystane punkty i nagrody przepadają z chwilą usunięcia konta.',
      ],
    },
    {
      heading: '§ 3. Punkty, poziomy i nagrody',
      list: [
        'Za opłacone zamówienia przypisane do konta (w Serwisie, przy barze lub na Kiosku po podaniu numeru telefonu) uczestnik otrzymuje punkty według zasad widocznych w panelu Yummy Club.',
        'Punkty naliczane są po opłaceniu zamówienia. W przypadku anulowania zamówienia lub zwrotu punkty są odejmowane.',
        'Punkty można wymieniać na nagrody dostępne w panelu Yummy Club. Punkty i nagrody nie podlegają wymianie na gotówkę.',
        'Poziomy członkostwa i związane z nimi korzyści opisane są w panelu Yummy Club i mogą się zmieniać – zmiana nie odbiera punktów już zdobytych.',
        'Yummy może anulować punkty lub zawiesić konto w przypadku nadużyć (np. zakładania wielu kont, przypisywania cudzych zamówień).',
      ],
    },
    {
      heading: '§ 4. Kody rabatowe i kupony',
      list: [
        'Kod rabatowy można wpisać w koszyku w Serwisie, na Kiosku lub podać przy barze – przed złożeniem zamówienia.',
        'Do jednego zamówienia można użyć jednego kodu, chyba że warunki kodu stanowią inaczej.',
        'Kod może mieć ograniczony okres ważności, liczbę użyć, minimalną wartość zamówienia lub dotyczyć wybranych Dań – warunki są podawane przy kodzie.',
        'Rabatów i kodów nie można łączyć ze sobą ani z innymi promocjami, o ile ich warunki nie przewidują inaczej.',
        'Kody nie podlegają wymianie na gotówkę, a niewykorzystana część rabatu nie przechodzi na kolejne zamówienia.',
        'W razie odstąpienia od zamówienia lub jego anulowania kod jednorazowy może zostać przywrócony według uznania Yummy.',
      ],
    },
    {
      heading: '§ 5. Promocje',
      list: [
        'Szczegółowe warunki promocji (czas trwania, objęte produkty, limity) są podawane w Serwisie, na Kiosku lub w lokalu.',
        'Yummy może ograniczyć liczbę produktów dostępnych w promocji lub zakończyć ją wcześniej po wyczerpaniu zapasów – bez wpływu na zamówienia już przyjęte.',
      ],
    },
    {
      heading: '§ 6. Reklamacje i zmiany',
      list: [
        `Reklamacje dotyczące punktów, nagród, kodów i promocji można składać na ${LEGAL_EMAIL}. Rozpatrujemy je w ciągu 14 dni.`,
        'Zmiany regulaminu programu publikujemy w Serwisie z co najmniej 14-dniowym wyprzedzeniem. W sprawach nieuregulowanych stosuje się Regulamin składania zamówień.',
      ],
    },
  ],
}

const privacy: LegalDocument = {
  slug: 'polityka-prywatnosci',
  title: 'Polityka prywatności i plików cookies',
  tabLabel: 'Polityka prywatności',
  updatedAt: '20.10.2026',
  intro:
    'Dbamy o Twoją prywatność. Poniżej wyjaśniamy, jakie dane zbieramy, w jakim celu i jakie masz prawa – zgodnie z rozporządzeniem Parlamentu Europejskiego i Rady (UE) 2016/679 (RODO).',
  sections: [
    {
      heading: '1. Administrator danych',
      paragraphs: [
        `Administratorem danych osobowych jest ${COMPANY.name}, NIP ${COMPANY.nip}, ${COMPANY.address}. We wszystkich sprawach dotyczących danych osobowych napisz do nas na ${LEGAL_EMAIL}.`,
      ],
    },
    {
      heading: '2. Jakie dane i w jakim celu przetwarzamy',
      list: [
        'Zamówienia przez stronę – imię, numer telefonu, adres dostawy (przy dostawie), uwagi do zamówienia. Cel: realizacja zamówienia i kontakt w jego sprawie (art. 6 ust. 1 lit. b RODO).',
        'Zamówienia na Kiosku – zamówienie można złożyć bez podawania danych. Jeżeli podasz numer telefonu Yummy Club, wykorzystamy go wyłącznie do przypisania punktów do Twojego konta.',
        'Konto Yummy Club – adres e-mail, imię, numer telefonu, historia zamówień i punktów. Cel: prowadzenie konta i programu lojalnościowego (art. 6 ust. 1 lit. b RODO).',
        'Rozliczenia – dane z zamówień i faktur (w tym NIP nabywcy). Cel: obowiązki podatkowe i rachunkowe (art. 6 ust. 1 lit. c RODO).',
        'Reklamacje, zapytania i dochodzenie roszczeń – dane podane w zgłoszeniu. Cel: obsługa zgłoszenia i obrona przed roszczeniami (art. 6 ust. 1 lit. f RODO).',
        'Marketing – wyłącznie jeżeli wyrazisz na to zgodę (art. 6 ust. 1 lit. a RODO). Zgodę możesz wycofać w każdej chwili.',
      ],
    },
    {
      heading: '3. Odbiorcy danych',
      paragraphs: [
        'Dostęp do danych mają wyłącznie upoważnieni pracownicy Yummy oraz podmioty, które pomagają nam prowadzić Serwis i realizować zamówienia: dostawcy hostingu i bazy danych, poczty e-mail, logowania przez Google / Apple oraz biuro rachunkowe. Nie sprzedajemy danych osobowych.',
        'Część dostawców infrastruktury może przetwarzać dane poza Europejskim Obszarem Gospodarczym – w takim przypadku odbywa się to na podstawie standardowych klauzul umownych zatwierdzonych przez Komisję Europejską lub innych zabezpieczeń przewidzianych w RODO.',
      ],
    },
    {
      heading: '4. Jak długo przechowujemy dane',
      list: [
        'Dane z zamówień – przez czas realizacji zamówienia, a następnie przez okres wymagany przepisami podatkowymi i rachunkowymi oraz do przedawnienia ewentualnych roszczeń.',
        'Konto Yummy Club – do czasu usunięcia konta.',
        'Dane przetwarzane na podstawie zgody – do jej wycofania.',
        'Dane z zapytań i reklamacji – do zakończenia sprawy i przedawnienia roszczeń.',
      ],
    },
    {
      heading: '5. Twoje prawa',
      list: [
        'dostęp do danych i otrzymanie ich kopii,',
        'sprostowanie, usunięcie lub ograniczenie przetwarzania,',
        'przeniesienie danych do innego administratora,',
        'sprzeciw wobec przetwarzania opartego na prawnie uzasadnionym interesie,',
        'wycofanie zgody w dowolnym momencie (bez wpływu na wcześniejsze przetwarzanie),',
        'skarga do Prezesa Urzędu Ochrony Danych Osobowych (ul. Stawki 2, 00-193 Warszawa).',
      ],
      paragraphs: [
        `Aby skorzystać z praw, napisz na ${LEGAL_EMAIL}. Odpowiemy bez zbędnej zwłoki, nie później niż w ciągu miesiąca. Dane konta Yummy Club możesz też samodzielnie edytować po zalogowaniu.`,
      ],
    },
    {
      heading: '6. Dobrowolność i profilowanie',
      paragraphs: [
        'Podanie danych jest dobrowolne, ale niezbędne do realizacji zamówienia z dostawą lub odbiorem oraz do założenia konta Yummy Club. Nie podejmujemy decyzji w sposób zautomatyzowany i nie profilujemy Cię w rozumieniu RODO.',
      ],
    },
    {
      heading: '7. Pliki cookies i pamięć przeglądarki',
      list: [
        'Pliki cookies niezbędne – utrzymują sesję po zalogowaniu do Yummy Club i zabezpieczają Serwis. Bez nich logowanie nie działa.',
        'Pamięć lokalna przeglądarki – zapamiętuje zawartość koszyka i wybrane ustawienia na Twoim urządzeniu.',
        'Statystyki – korzystamy z anonimowej analityki odwiedzin (Vercel Web Analytics), która nie używa plików cookies i nie pozwala Cię zidentyfikować.',
        'Logowanie przez Google lub Apple – przy tej opcji dostawca może zapisać własne pliki cookies zgodnie ze swoją polityką prywatności.',
      ],
      paragraphs: [
        'Możesz w każdej chwili zmienić ustawienia cookies lub je usunąć w swojej przeglądarce – może to jednak uniemożliwić logowanie lub zapamiętanie koszyka.',
      ],
    },
    {
      heading: '8. Logi serwera i bezpieczeństwo',
      paragraphs: [
        'Serwer automatycznie rejestruje podstawowe informacje techniczne (adres IP, typ przeglądarki, czas wizyty). Wykorzystujemy je wyłącznie do diagnozowania problemów i ochrony Serwisu przed nadużyciami.',
        'Stosujemy szyfrowane połączenie (HTTPS), a hasła przechowujemy w postaci zaszyfrowanej. Nigdy nie prosimy o podanie hasła e-mailem, SMS-em ani telefonicznie.',
      ],
    },
    {
      heading: '9. Zmiany polityki',
      paragraphs: ['O zmianach niniejszej polityki informujemy w Serwisie. Data ostatniej aktualizacji jest podana na górze dokumentu.'],
    },
  ],
}

const rodo: LegalDocument = {
  slug: 'rodo',
  title: 'Klauzula informacyjna RODO',
  tabLabel: 'Klauzula RODO',
  updatedAt: '20.10.2026',
  intro: 'Skrócona informacja o przetwarzaniu danych przy składaniu zamówień, zakładaniu konta i kontakcie z nami.',
  sections: [
    {
      heading: 'Zamówienia i Yummy Club',
      list: [
        `Administratorem Twoich danych osobowych jest ${COMPANY.name}, ${COMPANY.address}, e-mail: ${LEGAL_EMAIL}.`,
        'Dane przetwarzamy w celu realizacji zamówienia i prowadzenia konta Yummy Club, a jeżeli wyrazisz zgodę – także w celu marketingu bezpośredniego naszych produktów.',
        'Dane mogą być powierzane podmiotom świadczącym dla nas usługi techniczne i organizacyjne, wyłącznie w zakresie niezbędnym do realizacji zamówienia.',
        'Dane przechowujemy przez czas realizacji zamówienia, a następnie przez okres wynikający z przepisów podatkowych i rachunkowych oraz do przedawnienia roszczeń. Dane przetwarzane na podstawie zgody – do jej wycofania.',
        'Podanie danych jest dobrowolne, ale niezbędne do realizacji zamówienia z dostawą lub odbiorem. Zamówienie na Kiosku można złożyć bez podawania danych.',
      ],
    },
    {
      heading: 'Formularze kontaktowe i zapytania',
      list: [
        'Dane podane w zapytaniu przetwarzamy wyłącznie w celu odpowiedzi na nie.',
        'Dostęp do nich mają tylko pracownicy i osoby upoważnione przez Administratora.',
        'Dane przechowujemy do zakończenia korespondencji.',
      ],
    },
    {
      heading: 'Twoje prawa',
      list: [
        'Masz prawo dostępu do swoich danych, ich sprostowania, usunięcia lub ograniczenia przetwarzania, przeniesienia do innego administratora oraz wniesienia sprzeciwu.',
        'Masz prawo wnieść skargę do Prezesa Urzędu Ochrony Danych Osobowych.',
        'Twoje dane nie podlegają profilowaniu ani zautomatyzowanemu podejmowaniu decyzji.',
        'Szczegóły znajdziesz w Polityce prywatności.',
      ],
    },
  ],
}

export const LEGAL_DOCUMENTS: LegalDocument[] = [regulamin, yummyClub, privacy, rodo]

export function isLegalSlug(value: unknown): value is LegalSlug {
  return LEGAL_DOCUMENTS.some((document) => document.slug === value)
}
