from lib import *


def story():
    s = []
    s += [h1('Spis treści'), sp(6), toc([
        ('1', 'Wprowadzenie i wizja produktu'),
        ('2', 'Architektura modułowa – przegląd'),
        ('3', 'Moduł A – Strona internetowa i zamówienia online'),
        ('4', 'Moduł B – Program lojalnościowy Yummy Club'),
        ('5', 'Moduł C – Kiosk samoobsługowy'),
        ('6', 'Moduł D – Panel operacyjny „Warsztat” (POS / back-office)'),
        ('7', 'Moduł E – Kuchnia i system wyświetlania zamówień (KDS)'),
        ('8', 'Moduł F – Kasa, płatności, fiskalizacja i rozliczenia'),
        ('9', 'Moduł G – Edytor menu'),
        ('10', 'Moduł H – Marketing, promocje i grywalizacja'),
        ('11', 'Moduł I – Raportowanie i analityka'),
        ('12', 'Moduł J – Użytkownicy, role i uprawnienia'),
        ('13', 'Moduł K – Ustawienia restauracji'),
        ('14', 'Powiadomienia i komunikacja'),
        ('15', 'Doświadczenie użytkownika, dostępność i urządzenia mobilne'),
        ('16', 'Widoczność w wyszukiwarkach (SEO) i dokumenty prawne'),
        ('17', 'Korzyści biznesowe dla Licencjobiorcy'),
        ('18', 'Weryfikacja funkcji – lista kontrolna odbioru'),
    ]), br()]

    s += [h1('1. Wprowadzenie i wizja produktu'),
          lead(f'{SYSTEM} to kompleksowy, dedykowany ekosystem cyfrowy dla nowoczesnej gastronomii, który łączy w jednym, spójnym '
               'środowisku wszystkie kanały sprzedaży, obsługę sali i kuchni, rozliczenia kasowe, marketing oraz program lojalnościowy.'),
          p('System został zaprojektowany od podstaw z myślą o realiach restauracji typu quick-service: dużym wolumenie zamówień w godzinach '
            'szczytu, wielu równoległych źródłach zamówień, konieczności błyskawicznej komunikacji między barem a kuchnią oraz rygorystycznych '
            'wymogach polskiego prawa podatkowego i ochrony danych osobowych. Każdy element platformy – od karty produktu na stronie '
            'internetowej, przez ekran kuchenny, po raport kasowy na koniec dnia – działa na wspólnych, zsynchronizowanych w czasie '
            'rzeczywistym danych.'),
          p('Platforma jest dostarczana w modelu chmurowym (SaaS) – nie wymaga instalacji serwerów w lokalu, kosztownego sprzętu dedykowanego '
            'ani ręcznych aktualizacji. Wystarczy przeglądarka internetowa na komputerze, tablecie lub smartfonie. Aktualizacje trafiają '
            'do wszystkich urządzeń centralnie – bez instalowania czegokolwiek w lokalu – i są planowane tak, aby nie zakłócać pracy restauracji.'),
          kpis([('4', 'kanały sprzedaży<br/>w jednym systemie'), ('100%', 'chmura – zero<br/>serwerów w lokalu'),
                ('Na żywo', 'synchronizacja<br/>bar ↔ kuchnia'), ('14', 'alergenów zgodnie<br/>z UE 1169/2011')]),
          h2('1.1. Kluczowe wyróżniki'),
          ul(['<b>Jedno źródło prawdy</b> – menu, ceny, dostępność produktów i statusy zamówień są wspólne dla strony, kiosku, baru i kuchni.',
              '<b>Czas rzeczywisty</b> – zmiany (np. wyłączenie produktu, nowe zamówienie, zmiana statusu) są widoczne na wszystkich urządzeniach w ułamku sekundy.',
              '<b>Wielowarstwowe zabezpieczenia</b> – szyfrowanie SSL/TLS, kontrola dostępu oparta na rolach, izolacja danych na poziomie pojedynczych rekordów.',
              '<b>Pełna samodzielność Licencjobiorcy</b> – edycja menu, cen, zdjęć, promocji, godzin otwarcia i stref dostawy bez udziału programisty.',
              '<b>Zgodność z polskimi realiami</b> – stawki VAT na poziomie produktu, obsługa drukarek fiskalnych, raporty dobowe, NIP nabywcy, RODO.',
              '<b>Wbudowana lojalność i grywalizacja</b> – program klubowy z poziomami, gwiazdkami, kołem fortuny, kuponami i kampaniami sezonowymi.',
              '<b>Aplikacja instalowalna</b> – panel operacyjny i strona działają jak natywne aplikacje (PWA) na tabletach i telefonach.']),
          br()]

    s += [h1('2. Architektura modułowa – przegląd'),
          p('Platforma składa się z zestawu ściśle zintegrowanych modułów. Każdy z nich może być rozwijany niezależnie, a jednocześnie '
            'korzysta ze wspólnej warstwy danych, uwierzytelniania i komunikacji w czasie rzeczywistym.'),
          table([
              ['Moduł', 'Przeznaczenie', 'Użytkownicy'],
              ['A. Strona i zamówienia online', 'Prezentacja marki, menu, koszyk, zamówienia z dostawą i odbiorem, zamówienia na godzinę', 'Klienci'],
              ['B. Yummy Club', 'Konto klienta, gwiazdki, poziomy, nagrody, kupony, koło fortuny, śledzenie zamówień', 'Klienci zarejestrowani'],
              ['C. Kiosk samoobsługowy', 'Składanie zamówień w lokalu na ekranie dotykowym', 'Goście w lokalu'],
              ['D. Panel „Warsztat”', 'Przyjmowanie i obsługa zamówień, klienci, ustawienia, tryb szkoleniowy', 'Administrator, Szef/Kierownik, Pracownik'],
              ['E. Kuchnia (KDS)', 'Tablica zamówień kuchennych, stanowiska, timery, alarmy', 'Pracownik (kuchnia)'],
              ['F. Kasa i fiskalizacja', 'Płatności, paragony, szuflada kasowa, raporty kasowe i fiskalne', 'Pracownik (bar), Szef/Kierownik, Administrator'],
              ['G. Edytor menu', 'Produkty, kategorie, modyfikatory, alergeny, składniki, VAT, zdjęcia', 'Administrator, Szef/Kierownik'],
              ['H. Marketing', 'Promocje, kody rabatowe, ekonomika nagród, kampanie sezonowe', 'Administrator, Szef/Kierownik'],
              ['I. Raporty', 'Raporty dzienne, miesięczne, kasowe, wykresy sprzedaży', 'Administrator, Szef/Kierownik'],
              ['J. Użytkownicy i role', 'Zaproszenia, role, uprawnienia', 'Administrator'],
          ], [0.27, 0.5, 0.23]),
          box('Jedna platforma zamiast pięciu systemów',
              'Tradycyjnie restauracja korzysta z osobnego systemu POS, osobnej strony z zamówieniami, zewnętrznego programu lojalnościowego, '
              'oddzielnego kiosku i arkuszy kalkulacyjnych do raportów. ' + SYSTEM + ' zastępuje je jednym rozwiązaniem, eliminując ręczne '
              'przepisywanie zamówień, rozbieżności w cenach i koszty wielu abonamentów.'),
          br()]

    s += [h1('3. Moduł A – Strona internetowa i zamówienia online'),
          lead('Reprezentacyjna, szybka i w pełni responsywna witryna marki, która jednocześnie jest wydajnym sklepem internetowym.'),
          h2('3.1. Prezentacja marki'),
          ul(['Strona główna z dynamiczną karuzelą hero, sekcją wyróżników, prezentacją składników i sekcją FAQ.',
              'Sekcja aktualnych promocji zasilana na żywo z panelu marketingowego.',
              'Sekcje kampanii sezonowych (np. motyw Halloween) włączane i wyłączane bez ingerencji w kod.',
              'Profesjonalna fotografia produktów w zoptymalizowanym, lekkim formacie graficznym nowej generacji.',
              'Stopka z danymi firmy, linkami do regulaminów oraz odnośnikami do platform zewnętrznych.']),
          h2('3.2. Menu online'),
          ul(['Menu pogrupowane w kategorie z przyklejonym paskiem nawigacji kategorii, automatycznie podświetlającym bieżącą sekcję.',
              'Karty produktów z ceną, zdjęciem, opisem i oznaczeniami; animowane szkielety ładowania dla płynnego odbioru.',
              'Okno szczegółów produktu z pełnym opisem, listą składników oraz piktogramami 14 alergenów zgodnie z rozporządzeniem UE 1169/2011.',
              'Konfigurator produktu: warianty, dodatki, sosy, zestawy, grupy wyboru z limitami minimum/maksimum, automatyczne przeliczanie ceny.',
              'Dostępność produktów aktualizowana w czasie rzeczywistym – produkt wyłączony w panelu natychmiast znika z możliwości zamówienia.',
              'Ceny klubowe – zalogowani członkowie Yummy Club widzą swoje rabaty poziomowe bezpośrednio przy produktach.']),
          h2('3.3. Koszyk i składanie zamówienia'),
          ul(['Wysuwany koszyk z edycją ilości, podglądem konfiguracji pozycji i podsumowaniem kosztów.',
              'Wybór formy realizacji: <b>odbiór osobisty</b> lub <b>dostawa</b>.',
              'Zamówienia „na teraz” lub <b>zamówienia zaplanowane na konkretną godzinę</b> z selektorem terminów dopasowanym do godzin otwarcia.',
              'Weryfikacja adresu dostawy z geolokalizacją do poziomu ulicy, obliczeniem odległości od lokalu i przypisaniem do strefy dostawy.',
              'Strefy dostawy z indywidualnymi opłatami oraz progami darmowej dostawy konfigurowanymi przez restaurację.',
              'Wybór preferowanej metody płatności oraz możliwość podania NIP nabywcy do faktury.',
              'Realizacja kodów rabatowych, kuponów klubowych i nagród bezpośrednio w koszyku.',
              'Zamówienie jako gość lub z kontem klubowym (z naliczeniem gwiazdek).',
              'Komunikaty o niedostępności – system informuje, gdy lokal jest zamknięty, przyjmowanie zamówień wstrzymane lub produkt niedostępny.',
              'Ochrona przed podwójnym złożeniem zamówienia (np. przy dwukrotnym kliknięciu lub słabym zasięgu) dzięki unikalnemu identyfikatorowi żądania.']),
          h2('3.4. Status restauracji na żywo'),
          p('Strona w czasie rzeczywistym prezentuje, czy restauracja jest otwarta, czy przyjmuje zamówienia online oraz jakie są godziny '
            'otwarcia. Kierownictwo może jednym kliknięciem w panelu wstrzymać lub wznowić zamówienia (np. przy przeciążeniu kuchni) – '
            'zmiana jest natychmiast widoczna dla klientów.'),
          br()]

    s += [h1('4. Moduł B – Program lojalnościowy Yummy Club'),
          lead('Rozbudowany, w pełni zintegrowany program klubowy, który zamienia jednorazowych gości w lojalnych, powracających klientów.'),
          h2('4.1. Konto klienta'),
          ul(['Rejestracja e-mail z potwierdzeniem adresu oraz brandowanymi wiadomościami e-mail (rejestracja, reset hasła, zmiana adresu, powiadomienia o zmianie hasła).',
              'Potwierdzenie rejestracji jednorazowym, 6-cyfrowym kodem wysyłanym na adres e-mail klienta.',
              'Możliwość podania numeru telefonu w profilu – ułatwia odnalezienie konta klienta przy barze i powiązanie z nim zakupu.',
              'Bezpieczne odzyskiwanie i zmiana hasła, ustawienia konta, możliwość zarządzania danymi.',
              'Historia zamówień oraz <b>śledzenie statusu bieżącego zamówienia na żywo</b> (przyjęte, w przygotowaniu, gotowe, wydane).',
              'Mobilna nawigacja dolna zoptymalizowana pod obsługę jedną ręką.']),
          h2('4.2. Gwiazdki i poziomy członkostwa'),
          p('Za każdy zakup klient otrzymuje gwiazdki. Postęp do kolejnego poziomu liczony jest wyłącznie z gwiazdek zdobytych za zakupy, '
            'co chroni program przed sztucznym zawyżaniem statusu.'),
          table([['Poziom', 'Próg (gwiazdki z zakupów)', 'Stały rabat'],
                 ['Fan', 'od 0', '—'], ['Srebrny Fan', 'od 100', '5%'], ['Złoty Fan', 'od 300', '10%']], [0.34, 0.38, 0.28]),
          h2('4.3. Nagrody i grywalizacja'),
          ul(['<b>Koło fortuny</b> – codzienny darmowy obrót oraz dodatkowe obroty za gwiazdki; konfigurowalne nagrody i prawdopodobieństwa.',
              '<b>Katalog nagród</b> – wymiana gwiazdek na produkty i rabaty.',
              '<b>Kupony</b> z terminem ważności, przypisane do konta, realizowane online lub przy barze.',
              '<b>Kody promocyjne</b> wpisywane w aplikacji klubowej (punkty, darmowy produkt, rabat procentowy lub kwotowy).',
              '<b>Gry i kampanie sezonowe</b> – np. interaktywna gra Halloween z nagrodami, dekoracjami i oprawą dźwiękową.',
              'Animacje wygranych i efekty wizualne zwiększające zaangażowanie użytkowników.']),
          box('Wartość biznesowa programu',
              ['Wzrost częstotliwości wizyt dzięki poziomom i codziennym mechanikom.',
               'Własna baza klientów – niezależność od prowizyjnych platform pośredniczących.',
               'Pełna kontrola kosztów nagród dzięki wbudowanym kalkulatorom ekonomiki (moduł H).']),
          br()]

    s += [h1('5. Moduł C – Kiosk samoobsługowy'),
          lead('Ekran dotykowy w lokalu, który skraca kolejki i zwiększa średnią wartość koszyka.'),
          ul(['Pełnoekranowy, odporny na przypadkowe wyjście tryb pracy z dużymi elementami dotykowymi.',
              'Ekran startowy, menu z kategoriami, konfigurator produktów i podsumowanie zamówienia.',
              'Automatyczny powrót do ekranu startowego po 90 sekundach bezczynności – kolejny gość zawsze zaczyna od czystego ekranu.',
              'Dedykowana rola „kiosk” – urządzenie ma dostęp wyłącznie do funkcji składania zamówień, bez wglądu w dane operacyjne.',
              'Zamówienia z kiosku trafiają natychmiast na bar i kuchnię z oznaczeniem źródła.',
              'Dostęp do regulaminu i informacji prawnych bezpośrednio z ekranu kiosku.',
              'Weryfikacja dostępności lokalu i produktów przed przyjęciem zamówienia.']),
          br()]

    s += [h1('6. Moduł D – Panel operacyjny „Warsztat”'),
          lead('Serce systemu: nowoczesny panel POS i back-office działający na tablecie, komputerze lub telefonie, instalowalny jak aplikacja.'),
          h2('6.1. Pulpit zamówień'),
          ul(['Wszystkie zamówienia ze wszystkich kanałów (strona, kiosk, bar, platformy zewnętrzne) w jednym widoku, z oznaczeniem źródła.',
              'Karty zamówień z timerem czasu realizacji, odliczaniem do zamówień zaplanowanych i wyróżnieniem opóźnień.',
              'Alarm dźwiękowy i wizualny dla nowych zamówień zewnętrznych – żadne zamówienie nie zostanie przeoczone.',
              'Szczegóły zamówienia, historia zmian, dane klienta, adres i odległość dostawy.',
              'Wskaźnik stanu połączenia – obsługa zawsze wie, czy urządzenie jest zsynchronizowane.']),
          h2('6.2. Obsługa zamówień przy barze'),
          ul(['Szybkie tworzenie zamówienia przy barze z pogrupowanym menu i konfiguratorem pozycji.',
              'Dobór opakowań, przypisanie zamówienia do klienta klubowego (po numerze telefonu lub kodzie), realizacja kuponów i kodów.',
              'Edycja zamówienia, anulowanie z możliwością przywrócenia, zgłaszanie problemów, zwroty.',
              'Pełny przepływ statusów: przyjęte → w przygotowaniu → gotowe → wydane, z regułami biznesowymi (np. wydanie wymaga opłaconego paragonu).']),
          h2('6.3. Klienci'),
          ul(['Baza klientów z historią aktywności i zamówień.',
              'Narzędzia klubowe: podgląd salda gwiazdek, poziomu, kuponów; ręczna korekta gwiazdek z limitem bezpieczeństwa.',
              'Wydawanie kuponów i nagród przy barze.']),
          h2('6.4. Tryb szkoleniowy i demonstracyjny'),
          p('Wbudowane środowisko szkoleniowe (piaskownica) pozwala nowym pracownikom ćwiczyć obsługę zamówień i płatności na danych '
            'testowych, bez wpływu na rzeczywistą sprzedaż, raporty i fiskalizację. Skraca to czas wdrożenia nowego pracownika do minimum.'),
          h2('6.5. Aplikacja instalowalna'),
          p('Panel może zostać zainstalowany na ekranie głównym tabletu lub telefonu (w tym urządzeń z systemem Android), działa w trybie '
            'pełnoekranowym, posiada własną ikonę i obsługuje powiadomienia push.'),
          br()]

    s += [h1('7. Moduł E – Kuchnia i KDS'),
          lead('Cyfrowa tablica kuchenna, która zastępuje papierowe bloczki i usprawnia pracę w godzinach szczytu.'),
          ul(['Tablica zamówień kuchennych z czytelnym podziałem na pozycje, dodatki i uwagi.',
              'Inteligentny podział pozycji na stanowiska (kuchnia / bar) – np. napoje i desery trafiają na bar, burgery i frytki na kuchnię.',
              'Konfigurator linii produkcyjnych dopasowany do układu kuchni.',
              'Timery i kolorystyczne wyróżnienie zamówień przekraczających czas.',
              'Powiadomienia push i dźwiękowe dla kuchni o nowych zamówieniach.',
              'Skalowanie widoku do wielkości ekranu – czytelność z odległości.',
              'Synchronizacja w czasie rzeczywistym za pomocą prywatnych, szyfrowanych kanałów komunikacji.']),
          br()]

    s += [h1('8. Moduł F – Kasa, płatności, fiskalizacja i rozliczenia'),
          h2('8.1. Płatności'),
          ul(['Obsługa płatności gotówką, kartą oraz <b>płatności dzielonych</b> (część gotówką, część kartą).',
              'Konfigurowalne, włączane i wyłączane metody płatności.',
              'Kalkulator reszty, rozliczanie zamówień nieopłaconych, oznaczanie płatności i czasu opłacenia.',
              'Zmiana metody płatności po fakcie wymaga <b>podpisu/potwierdzenia</b> i jest trwale rejestrowana w historii (ścieżka audytu).']),
          h2('8.2. Fiskalizacja'),
          ul(['Integracja z drukarkami fiskalnymi zgodnymi z polskimi wymogami; konfiguracja drukarki z poziomu panelu. Współpraca deklarowana jest dla urządzeń ujętych w wykazie urządzeń zweryfikowanych (Załącznik nr 3 pkt 6.1).',
              'Stawki VAT definiowane na poziomie każdego produktu i usługi (np. dostawa), z poprawnym rozbiciem na paragonie.',
              'Kolejka paragonów oczekujących oraz mechanizm odzyskiwania paragonu po awarii drukarki lub połączenia.',
              'Raport dobowy fiskalny generowany z panelu.',
              'Wydruk dokumentów niefiskalnych (bonów kuchennych, potwierdzeń).']),
          h2('8.3. Dzień operacyjny i szuflada kasowa'),
          ul(['Otwieranie i zamykanie dnia operacyjnego (ręcznie lub automatycznie) z blokadami chroniącymi spójność danych zamkniętego dnia.',
              'Ewidencja wpłat i wypłat z szuflady kasowej (operacje KP/KW).',
              'Raport kasowy na koniec zmiany z porównaniem stanu oczekiwanego i rzeczywistego, korektami i wydrukiem.',
              'Lista historycznych raportów kasowych.']),
          br()]

    s += [h1('9. Moduł G – Edytor menu'),
          lead('Pełna samodzielność w zarządzaniu ofertą – bez programisty, bez czekania, ze zmianami widocznymi natychmiast we wszystkich kanałach.'),
          table([['Funkcja', 'Opis'],
                 ['Produkty', 'Dodawanie, edycja, usuwanie, kolejność, opisy, ceny, limity długości nazw dla czytelności paragonów'],
                 ['Kategorie', 'Zarządzanie kategoriami z ikonami i zdjęciami, kolejność wyświetlania'],
                 ['Zdjęcia', 'Wgrywanie zdjęć z wbudowanym narzędziem kadrowania i podglądem'],
                 ['Modyfikatory', 'Grupy dodatków, wariantów i sosów; limity wyboru; dopłaty; przypisanie do stanowisk'],
                 ['Zestawy', 'Konfiguracja zestawów i zestawów dziecięcych z automatycznym podziałem na kuchnię i bar'],
                 ['Alergeny i składniki', 'Edytor 14 alergenów oraz listy składników dla każdego produktu'],
                 ['VAT', 'Indywidualna stawka VAT dla produktu i usług'],
                 ['Dostępność', 'Natychmiastowe włączanie/wyłączanie produktów (np. po wyczerpaniu)'],
                 ['Podgląd', 'Podgląd karty produktu dokładnie tak, jak zobaczy ją klient']], [0.25, 0.75]),
          box('Zmiany w czasie rzeczywistym',
              'Każda zmiana w edytorze jest propagowana na stronę, kiosk, panel baru i kuchnię w czasie rzeczywistym, '
              'z inteligentnym buforowaniem zapewniającym błyskawiczne ładowanie menu dla klientów.'),
          br()]

    s += [h1('10. Moduł H – Marketing, promocje i grywalizacja'),
          ul(['<b>Promocje</b> – rabaty procentowe i kwotowe, promocje typu „każdy n-ty produkt taniej”, promocje ograniczone do kanału (np. tylko online z odbiorem), harmonogram obowiązywania.',
              '<b>Kody promocyjne</b> – limity użyć, data ważności, budżet kampanii, koszt jednostkowy, rodzaj nagrody.',
              '<b>Edytor koła fortuny</b> – nagrody, wagi, koszt dodatkowego obrotu.',
              '<b>Ekonomika programu lojalnościowego</b> – kalkulatory realnego kosztu gwiazdki, nagród, koła i gier sezonowych.',
              '<b>Podsumowanie marketingowe</b> – zestawienie aktywnych kampanii, wykorzystania kodów i kosztów.',
              '<b>Kampanie sezonowe</b> – gotowe mechanizmy tematyczne aktywowane z panelu.',
              'Pasek aktywnych promocji widoczny dla obsługi baru – personel zawsze wie, co obecnie obowiązuje.']),
          box('Marketing pod kontrolą finansową',
              'Unikalną cechą platformy jest połączenie narzędzi marketingowych z analizą ekonomiczną. Przed uruchomieniem kampanii '
              'Licencjobiorca widzi jej przewidywany koszt, a w trakcie – realne wykorzystanie budżetu.'),
          h1('11. Moduł I – Raportowanie i analityka'),
          ul(['Raport dnia: sprzedaż, liczba zamówień, struktura płatności, źródła zamówień.',
              'Raporty miesięczne z wykresami i trendami.',
              'Raporty kasowe i fiskalne, raporty spóźnione i korekty.',
              'Wykresy interaktywne w panelu, wydruki raportów.',
              'Dane gotowe do przekazania biuru rachunkowemu.']),
          br()]

    s += [h1('12. Moduł J – Użytkownicy, role i uprawnienia'),
          p('Panel operacyjny nie posiada otwartej rejestracji – konta personelu są zakładane wewnątrz panelu. Każdy użytkownik ma '
            'przypisaną rolę, która precyzyjnie określa zakres dostępnych funkcji. Uprawnienia są weryfikowane po stronie serwera przy każdej operacji.'),
          p('Model uprawnień personelu obejmuje trzy poziomy, stosowane spójnie w całej dokumentacji:'),
          table([['Poziom', 'Kto', 'Zakres'],
                 ['Administrator', 'Osoba wskazana przez Licencjobiorcę',
                  'Pełne uprawnienia administracyjne; tworzy, edytuje i usuwa konta personelu oraz przydziela role, w tym rolę Szef/Kierownik; konfiguracja systemu'],
                 ['Szef / Kierownik', 'Osoba, której Administrator nadał tę rolę',
                  'Menu, marketing, raporty, ustawienia restauracji, kiosk, obsługa zamówień; zarządzanie kontami personelu '
                  'z wyłączeniem kont i roli Administratora'],
                 ['Pracownik', 'Personel restauracji',
                  'Funkcje przypisane do roli roboczej (patrz tabela poniżej)']], [0.18, 0.3, 0.52]),
          table([['Rola robocza (Pracownik)', 'Zakres funkcji'],
                 ['Bar (obsługa)', 'Przyjmowanie i obsługa zamówień, płatności, klienci, paragony'],
                 ['Kuchnia', 'Tablica kuchenna, zmiana statusów przygotowania, dostępność produktów'],
                 ['Kierowca', 'Funkcje związane z realizacją dostaw, w zakresie udostępnionym tej roli'],
                 ['Kiosk (konto urządzenia)', 'Wyłącznie składanie zamówień na urządzeniu samoobsługowym'],
                 ['Klient (poza personelem)', 'Własne konto klubowe, własne zamówienia i nagrody']], [0.3, 0.7]),
          small('Ochrona kont Administratora jest egzekwowana technicznie: osoba z rolą Szef/Kierownik nie może nadać roli Administratora '
                'ani zmienić lub usunąć konta Administratora, a system nie pozwala usunąć ostatniego Administratora. '
                'Zmiana roli użytkownika unieważnia jego aktywne sesje. Dostęp do konta Administratora udostępnia Licencjodawca '
                'w ramach Wdrożenia; dalej Licencjobiorca, za pośrednictwem Administratora, samodzielnie decyduje, komu nadaje '
                'konta i role (§ 3 i § 7 Umowy).'),
          h1('13. Moduł K – Ustawienia restauracji'),
          ul(['Godziny otwarcia z obsługą wyjątków.',
              'Ustawienia zamówień online: włączanie/wyłączanie, ręczne nadpisanie, minimalny czas realizacji.',
              'Strefy dostawy, promień, opłaty, darmowa dostawa.',
              'Metody płatności, ustawienia drukarki fiskalnej, opakowania.',
              'Sterowanie statusem restauracji jednym przyciskiem.']),
          h1('14. Powiadomienia i komunikacja'),
          ul(['Powiadomienia push dla obsługi i kuchni (także przy zminimalizowanej aplikacji).',
              'Sygnały dźwiękowe nowych zamówień.',
              'Brandowane wiadomości e-mail dla klientów w identyfikacji wizualnej marki.',
              'Sygnalizacja zmian statusu zamówienia klientowi w aplikacji klubowej.']),
          br()]

    s += [h1('15. UX, dostępność i urządzenia mobilne'),
          ul(['Podejście <b>mobile-first</b> – projekt optymalizowany najpierw pod smartfony, a następnie tablety i komputery.',
              'Zgodność z wytycznymi dostępności: semantyczna struktura, etykiety dla czytników ekranu, kontrast, obsługa klawiatury.',
              'Naturalne zachowanie przycisku „wstecz” na telefonach (zamyka okna dialogowe zamiast opuszczać stronę).',
              'Tryb pełnoekranowy na tabletach i kioskach.',
              'Działanie w najpopularniejszych przeglądarkach w aktualnych wersjach.']),
          h1('16. SEO i dokumenty prawne'),
          ul(['Automatycznie generowana mapa witryny i reguły dla robotów wyszukiwarek.',
              'Dane strukturalne i metadane społecznościowe (podgląd linków w komunikatorach i mediach społecznościowych).',
              'Dedykowany plik opisu witryny dla asystentów i wyszukiwarek opartych o sztuczną inteligencję.',
              'Manifest aplikacji, ikony i kolory motywu.',
              'Regulamin zamówień, regulamin Yummy Club, polityka prywatności i klauzula RODO dostępne w serwisie i kiosku.']),
          h1('17. Korzyści biznesowe'),
          table([['Obszar', 'Korzyść'],
                 ['Sprzedaż', 'Więcej kanałów, zamówienia na godzinę, wyższa wartość koszyka dzięki konfiguratorowi i kioskowi'],
                 ['Koszty', 'Brak prowizji od zamówień własnych, brak sprzętu serwerowego, mniej pomyłek'],
                 ['Operacje', 'Szybsza komunikacja bar–kuchnia, mniej papieru, krótsze szkolenia'],
                 ['Lojalność', 'Własna baza klientów, poziomy, nagrody, grywalizacja'],
                 ['Kontrola', 'Raporty w czasie rzeczywistym, ścieżka audytu płatności, kontrola kosztów marketingu'],
                 ['Zgodność', 'VAT, fiskalizacja, RODO, alergeny – wbudowane w proces']], [0.22, 0.78]),
          br(),
          h1('18. Weryfikacja funkcji – lista kontrolna odbioru'),
          p('Specyfikacja opisuje zakres funkcjonalny Systemu. Działanie funkcji potwierdzane jest w procedurze odbioru (§ 3 Umowy) '
            'na podstawie poniższej listy kontrolnej, wypełnianej wspólnie przez Strony na środowisku produkcyjnym Licencjobiorcy. '
            'Funkcje, których Licencjobiorca nie uruchamia, oznacza się jako „nie dotyczy”.'),
          table([['Moduł', 'Scenariusz testowy', 'Wynik (OK / uwagi / nie dotyczy)'],
                 ['A. Zamówienia online', 'Złożenie zamówienia z dostawą i z odbiorem, zamówienie na godzinę', '……………'],
                 ['B. Yummy Club', 'Rejestracja e-mail, potwierdzenie adresu, naliczenie i wymiana gwiazdek', '……………'],
                 ['C. Kiosk', 'Złożenie i opłacenie zamówienia w kiosku', '……………'],
                 ['D. Panel „Warsztat”', 'Przyjęcie zamówienia, zmiana statusu, zamówienie ręczne', '……………'],
                 ['E. KDS', 'Wyświetlenie zamówienia na kuchni w czasie rzeczywistym', '……………'],
                 ['F. Kasa i fiskalizacja', 'Paragon na urządzeniu z wykazu (Załącznik nr 3 pkt 6.1), raport kasowy i dobowy', '……………'],
                 ['G. Edytor menu', 'Dodanie i edycja produktu, zmiana dostępności', '……………'],
                 ['H. Marketing', 'Utworzenie i zastosowanie promocji', '……………'],
                 ['I. Raporty', 'Wygenerowanie raportu sprzedaży za wybrany okres', '……………'],
                 ['J. Użytkownicy i role', 'Utworzenie konta personelu i nadanie roli przez Administratora', '……………'],
                 ['K. Ustawienia', 'Zmiana godzin otwarcia i metod płatności', '……………'],
                 ['Inne', '……………', '……………']], [0.22, 0.50, 0.28]),
          p('Funkcje oznaczone wynikiem „OK” uznaje się za odebrane. Uwagi zgłoszone w protokole Licencjodawca rozpatruje na zasadach '
            '§ 3 i § 5 Umowy.')]
    return s


if __name__ == '__main__':
    build('../01_Specyfikacja_funkcjonalna_systemu.pdf', 'Specyfikacja funkcjonalna systemu', 'Załącznik nr 1 do Umowy',
          'Specyfikacja\nfunkcjonalna\nsystemu', 'Pełny opis modułów, funkcji i możliwości platformy\nZałącznik nr 1 do Umowy', story())
