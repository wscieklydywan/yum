from lib import *


def story():
    s = []
    s += [h1('Spis treści'), sp(6), toc([
        ('1', 'Architektura systemu'),
        ('2', 'Wydajność i skalowalność'),
        ('3', 'Strategia buforowania i dostarczania treści'),
        ('4', 'Synchronizacja w czasie rzeczywistym'),
        ('5', 'Aplikacje instalowalne (PWA)'),
        ('6', 'Wymagania sprzętowe i kompatybilność'),
        ('7', 'Proces wytwórczy, wdrożenia i zarządzanie zmianą'),
        ('8', 'Poziom usług (SLA) i dostępność systemu'),
        ('9', 'Wsparcie techniczne i utrzymanie'),
        ('10', 'Rozwój systemu'),
    ]), br()]

    s += [h1('1. Architektura systemu'),
          lead('Nowoczesna, chmurowa architektura warstwowa, projektowana z myślą o niezawodności, szybkości i łatwym rozwoju.'),
          table([['Warstwa', 'Opis'],
                 ['Warstwa brzegowa', 'Globalna sieć dostarczania treści (CDN) z węzłami w Europie; terminacja SSL/TLS, buforowanie zasobów statycznych, ochrona przed atakami'],
                 ['Warstwa prezentacji', 'Nowoczesny interfejs renderowany hybrydowo: po stronie serwera (szybkie pierwsze wyświetlenie, SEO) i po stronie klienta (interaktywność)'],
                 ['Warstwa usług (API)', 'Bezserwerowe punkty końcowe skalujące się automatycznie; blisko 50 wyspecjalizowanych usług dla klientów, kiosku i panelu'],
                 ['Warstwa logiki danych', 'Procedury serwerowe realizujące krytyczne operacje biznesowe atomowo i bezpiecznie'],
                 ['Warstwa danych', 'Zarządzana relacyjna baza danych klasy produkcyjnej z politykami dostępu na poziomie rekordów, szyfrowaniem i kopiami zapasowymi'],
                 ['Warstwa czasu rzeczywistego', 'Prywatne kanały zdarzeń zasilane wyzwalaczami bazodanowymi'],
                 ['Magazyn plików', 'Magazyn obiektów z kontrolą dostępu dla zdjęć produktów i kategorii (szyfrowanie w spoczynku po stronie dostawcy)'],
                 ['Usługi pomocnicze', 'Wysyłka e-mail, powiadomienia push, geolokalizacja adresów']], [0.24, 0.76]),
          p('Rozdzielenie odpowiedzialności pomiędzy warstwy pozwala na niezależne skalowanie, łatwe testowanie i bezpieczne wprowadzanie '
            'zmian. Platforma nie wymaga utrzymywania żadnych serwerów w lokalu Licencjobiorcy.'),
          h1('2. Wydajność i skalowalność'),
          ul(['Architektura <b>bezserwerowa</b> – moc obliczeniowa przydzielana automatycznie do aktualnego obciążenia, co pomaga utrzymać płynność pracy także w godzinach szczytu.',
              'Optymalizacja pod kątem wskaźników <b>Core Web Vitals</b> (szybkość ładowania, stabilność układu, responsywność).',
              'Lekkie, nowoczesne formaty graficzne i długotrwałe buforowanie zasobów.',
              'Indeksy bazodanowe dobierane na podstawie analizy zapytań.',
              'Ograniczanie zbędnych zapytań – publiczne zasoby (menu, promocje, status) pomijają kosztowne operacje sesyjne.',
              'Inteligentne odpytywanie i aktualizacje przyrostowe w panelu operacyjnym.']),
          br()]

    s += [h1('3. Buforowanie i dostarczanie treści'),
          table([['Zasób', 'Strategia'],
                 ['Zdjęcia, ikony, logotypy', 'Bufor przeglądarki 7 dni, bufor CDN do kolejnego wdrożenia, odświeżanie w tle'],
                 ['Menu i promocje', 'Bufor krótkoterminowy z natychmiastowym unieważnieniem przy zmianie w panelu'],
                 ['Status restauracji', 'Aktualizacja w czasie rzeczywistym'],
                 ['Dane panelu', 'Bez buforowania publicznego – zawsze aktualne dane']], [0.3, 0.7]),
          h1('4. Synchronizacja w czasie rzeczywistym'),
          p('Zdarzenia (nowe zamówienie, zmiana statusu, zmiana dostępności produktu, zmiana menu) są emitowane bezpośrednio z warstwy '
            'danych i zwykle docierają do subskrybentów w ułamku sekundy. Panel posiada wskaźnik stanu połączenia oraz mechanizmy automatycznego '
            'ponownego łączenia i dosynchronizowania po utracie zasięgu, ograniczające ryzyko przeoczenia zamówień.'),
          h1('5. Aplikacje instalowalne (PWA)'),
          ul(['Panel „Warsztat” oraz serwis klienta mogą być instalowane na ekranie głównym urządzenia.',
              'Własny manifest, ikony, tryb pełnoekranowy, obsługa powiadomień push.',
              'Mechanizm aktualizacji – nowa wersja aplikacji instaluje się automatycznie.',
              'Brak konieczności publikacji w sklepach z aplikacjami i ich prowizji.']),
          h1('6. Wymagania sprzętowe i kompatybilność'),
          table([['Stanowisko', 'Zalecane urządzenie'],
                 ['Bar / POS', 'Tablet 10"+ lub komputer z aktualną przeglądarką; stałe łącze internetowe'],
                 ['Kuchnia (KDS)', 'Tablet lub monitor dotykowy, montaż ścienny; zalecana duża przekątna'],
                 ['Kiosk', 'Ekran dotykowy w obudowie kioskowej, tryb pełnoekranowy'],
                 ['Fiskalizacja', 'Drukarka fiskalna z wykazu urządzeń zweryfikowanych (pkt 6.1), podłączona do stanowiska baru'],
                 ['Klienci', 'Dowolny smartfon, tablet lub komputer z aktualną przeglądarką'],
                 ['Sieć', 'Łącze min. 10 Mb/s, zalecane łącze zapasowe (np. LTE)']], [0.25, 0.75]),
          h2('6.1. Wykaz urządzeń fiskalnych zweryfikowanych z Systemem'),
          p('Integracja z drukarką fiskalną <b>POSNET Thermal XL2 Online</b> została wykonana zgodnie z dokumentacją techniczną '
            'producenta i zweryfikowana przez Licencjodawcę w wielu testach: testach automatycznych, testach na symulatorach '
            'urządzenia oraz testach fizycznych na urządzeniu pracującym w lokalu. Weryfikacja objęła m.in. wydruk paragonu '
            'z różnymi stawkami VAT, płatność dzieloną, ponowienie wydruku z kolejki po przerwaniu połączenia oraz raport dobowy.'),
          p('Pozostałe pozycje wykazu uzupełniają Strony podczas Wdrożenia na podstawie testu w tym samym zakresie, przeprowadzonego '
            'na urządzeniach Licencjobiorcy. Licencjodawca deklaruje współpracę Systemu wyłącznie z urządzeniami ujętymi w wykazie, '
            'w konfiguracji, w której zostały przetestowane. Zmiana oprogramowania urządzenia przez producenta lub serwis fiskalny '
            'może wymagać ponownej weryfikacji.'),
          table([['Producent', 'Model', 'Wersja oprogramowania / protokół', 'Data testu', 'Wynik'],
                 ['POSNET', 'Thermal XL2 Online', 'protokół POSNET (wg dokumentacji producenta)', 'testy Licencjodawcy', 'pozytywny'],
                 ['……………', '……………', '……………', '……………', '……………'],
                 ['……………', '……………', '……………', '……………', '……………']], [0.2, 0.2, 0.26, 0.16, 0.18]),
          p('Weryfikacja kolejnych urządzeń lub nowych wersji ich oprogramowania odbywa się na zasadach § 2 ust. 4 Umowy, '
            'chyba że Strony uzgodnią inaczej.'),
          br()]

    s += [h1('7. Proces wytwórczy i wdrożenia'),
          ul(['Kod źródłowy w systemie kontroli wersji z pełną historią zmian.',
              '<b>Ciągłe wdrażanie</b>: każda zmiana trafia najpierw na środowisko podglądowe, a po akceptacji na produkcję.',
              'Wdrożenia projektowane tak, aby nie powodować przestojów, z możliwością szybkiego powrotu do poprzedniej wersji w razie problemu.',
              'Wersjonowane migracje struktury danych (ponad 50 kontrolowanych migracji w historii projektu).',
              'Typowanie statyczne kodu (TypeScript) i kontrola poprawności przy budowaniu aplikacji.',
              'Konfiguracja wrażliwa (klucze, sekrety) przechowywana wyłącznie w zaszyfrowanych zmiennych środowiskowych.']),
          h1('8. Poziom usług (SLA) i dostępność systemu'),
          p('System jest przeznaczony do pracy całodobowej i działa na infrastrukturze profesjonalnych dostawców usług chmurowych, '
            'z automatycznym skalowaniem i kopiami zapasowymi realizowanymi w ramach ich usług.'),
          box('Charakter SLA', 'Parametry określone w niniejszym punkcie są <b>parametrami docelowymi</b>, do których osiągnięcia '
              'Licencjodawca dokłada należytej staranności (zobowiązanie starannego działania, a nie rezultatu). Ich nieosiągnięcie '
              'nie stanowi samo w sobie niewykonania lub nienależytego wykonania Umowy i nie uprawnia do kar umownych, obniżenia '
              'wynagrodzenia ani odszkodowania – z zastrzeżeniem § 5 ust. 7 Umowy.'),
          h2('8.1. Dostępność docelowa'),
          table([['Parametr', 'Wartość docelowa'],
                 ['Dostępność Systemu', '99,0% w skali miesiąca kalendarzowego (serwis klienta, kiosk i panel operacyjny)'],
                 ['Sposób ustalania', 'Na podstawie zgłoszeń Licencjobiorcy oraz informacji o stanie usług publikowanych przez dostawców infrastruktury'],
                 ['Prace planowane', 'W miarę możliwości poza godzinami otwarcia restauracji; o pracach mogących powodować przerwę Licencjodawca w miarę możliwości uprzedza z wyprzedzeniem']],
                [0.28, 0.72]),
          p('Do czasu niedostępności nie wlicza się przerw wynikających z: awarii lub prac po stronie dostawców infrastruktury i usług '
            'zewnętrznych, łącza internetowego, sieci, sprzętu i oprogramowania w lokalu Licencjobiorcy, działań Licencjobiorcy, '
            'jego personelu lub osób trzecich, ataków na infrastrukturę, siły wyższej, prac planowanych oraz zawieszenia dostępu '
            'zgodnie z Umową.'),
          h2('8.2. Docelowe czasy obsługi zgłoszeń'),
          p('Czasy liczone są od chwili przyjęcia zgłoszenia przez Licencjodawcę w godzinach wsparcia: dni robocze, w godz. 9:00–17:00. '
            'Dla zgłoszeń krytycznych celem jest przywrócenie działania Systemu lub wdrożenie obejścia; dla pozostałych kategorii – '
            'podjęcie działań, a usunięcie Błędu następuje w terminie zależnym od jego charakteru.'),
          table([['Kategoria zgłoszenia', 'Przykład', 'Cel obsługi'],
                 ['Krytyczne', 'System całkowicie niedostępny, brak możliwości przyjmowania zamówień', 'przywrócenie działania lub obejście w ciągu 30–60 minut'],
                 ['Istotne', 'Niedziałająca pojedyncza funkcja, istnieje obejście', 'podjęcie działań do 2 dni roboczych'],
                 ['Pozostałe', 'Drobne błędy, pytania, sugestie', 'podjęcie działań do 5 dni roboczych']], [0.22, 0.44, 0.34]),
          p('Zgłoszenia krytyczne należy przekazywać telefonicznie oraz drogą elektroniczną na dane kontaktowe wskazane w protokole '
            'odbioru. Zgłoszenia krytyczne przekazane poza godzinami wsparcia Licencjodawca obsługuje w miarę dostępnych możliwości, '
            'bez zobowiązania do dyżuru. Czas 30–60 minut nie dotyczy awarii, których przyczyna leży po stronie dostawców infrastruktury '
            'i usług zewnętrznych, łącza, sieci lub urządzeń w lokalu Licencjobiorcy – w takich przypadkach Licencjodawca podejmuje '
            'działania w zakresie od siebie zależnym i informuje Licencjobiorcę o sytuacji.'),
          h2('8.3. Wydajność docelowa'),
          ul(['Cel: wskaźniki Core Web Vitals publicznego serwisu klienta w zakresie „dobry” według metodologii Google, mierzone dla typowych stron (menu, koszyk) przy sprawnym łączu i aktualnej przeglądarce.',
              'Na faktyczną szybkość działania wpływają m.in. jakość łącza, parametry i obciążenie urządzeń oraz działanie usług zewnętrznych; czynniki te pozostają poza kontrolą Licencjodawcy.']),
          box('Zasada', 'Dostępność 99,0%, czas obsługi awarii krytycznych 30–60 minut oraz pozostałe wartości z pkt 8.1–8.3 są '
              'celami starannego działania, a nie gwarancją rezultatu. Licencjodawca nie prowadzi całodobowego monitorowania ani dyżurów.'),
          h1('9. Wsparcie i utrzymanie'),
          ul(['Podstawowa pomoc techniczna w rozsądnym zakresie, drogą elektroniczną lub telefoniczną w dni robocze, z docelowymi czasami podjęcia działań określonymi w pkt 8.2 (cele, nie gwarancje).',
              'Aktualizacje bezpieczeństwa i poprawki błędów dostarczane w miarę potrzeb i możliwości technicznych, bez gwarantowanego terminu wdrożenia.',
              'Brak całodobowego monitorowania Systemu, dyżurów, natychmiastowej interwencji i przywracania działania w określonym czasie.',
              'Wsparcie nie obejmuje ręcznej obsługi zamówień, stałego nadzoru operacyjnego, bezpłatnych prac rozwojowych, szkoleń personelu ani konfiguracji sprzętu w lokalu; System zawiera wbudowany tryb szkoleniowy (Załącznik nr 1, pkt 6.4).',
              'Zakres i zasady wsparcia określa § 5 Umowy.']),
          h1('10. Rozwój systemu'),
          p('Architektura modułowa umożliwia dodawanie nowych kanałów sprzedaży, integracji i lokalizacji. Nowe moduły, integracje, '
            'rozbudowa funkcji, większe poprawki i inne prace indywidualne nie są objęte wynagrodzeniem miesięcznym i mogą by�� realizowane '
            'wyłącznie po odrębnym uzgodnieniu zakresu, terminu i wynagrodzenia (§ 2 ust. 4 Umowy).')]
    return s


if __name__ == '__main__':
    build('../03_Architektura_techniczna_i_dostepnosc.pdf', 'Architektura techniczna i dostępność', 'Załącznik nr 3 do Umowy',
          'Architektura\ntechniczna', 'Parametry techniczne, wydajność, wdrożenia i dostępność systemu\nZałącznik nr 3 do Umowy', story())
