from lib import *

B = '…………………………………'
FEE = '1000 zł (słownie: jeden tysiąc złotych) „na rękę”'


def par(title, points):
    out = [sec(title)]
    out.append(ol(points))
    return out


def story():
    s = [h1('Umowa wdrożenia, licencji i utrzymania systemu'),
         p(f'zawarta w dniu {B} w {B} pomiędzy:'),
         p(f'<b>{B}</b> (imię i nazwisko), zamieszkałym/-ą w {B}, PESEL {B}, nieprowadzącym/-ą działalności gospodarczej, '
           'zwanym/-ą dalej „<b>Licencjodawcą</b>”,'),
         p('a'),
         p(f'<b>{CLIENT["name"]}</b> – spółką cywilną, {CLIENT["address"]}, NIP {CLIENT["nip"]}, reprezentowaną przez {B}, '
           'zwaną dalej „<b>Licencjobiorcą</b>”,'),
         p('zwanymi dalej łącznie „Stronami”, a każda z osobna „Stroną”.')]

    s += par('§ 1. Definicje', [
        f'<b>System</b> – oprogramowanie „{SYSTEM}” udostępniane w modelu chmurowym, obejmujące moduły opisane w Załączniku nr 1.',
        '<b>Wdrożenie</b> – wstępna konfiguracja Systemu dla Licencjobiorcy, podłączenie domeny oraz utworzenie konta Administratora, '
        'w zakresie opisanym w § 3.',
        '<b>Utrzymanie</b> – udostępnianie Systemu w modelu chmurowym oraz podstawowe wsparcie techniczne w zakresie określonym w § 5.',
        '<b>Błąd</b> – powtarzalne działanie Systemu niezgodne ze Specyfikacją (Załącznik nr 1), niewynikające z działań Licencjobiorcy, '
        'jego sprzętu, sieci ani usług podmiotów trzecich.',
        '<b>Administrator</b> – osoba wskazana przez Licencjobiorcę, której Licencjodawca udostępnia konto z uprawnieniami '
        'administracyjnymi w Systemie i która w imieniu Licencjobiorcy samodzielnie zarządza dostępem personelu; '
        '<b>Szef/Kierownik</b> i <b>Pracownik</b> – role personelu opisane w Załączniku nr 1.',
        '<b>Dane Licencjobiorcy</b> – wszelkie dane wprowadzone do Systemu przez Licencjobiorcę, jego personel lub klientów.',
    ])
    s += par('§ 2. Przedmiot Umowy', [
        'Licencjodawca zobowiązuje się do przeprowadzenia Wdrożenia, udzielenia Licencjobiorcy licencji na korzystanie z Systemu '
        'oraz świadczenia Utrzymania na zasadach określonych w Umowie.',
        'Zakres funkcjonalny Systemu określa Załącznik nr 1, opis zabezpieczeń Załącznik nr 2, a architekturę techniczną i informacje '
        'o dostępności Systemu Załącznik nr 3. Zasady powierzenia przetwarzania danych osobowych określa Załącznik nr 4.',
        'System obejmuje w szczególności: serwis internetowy z zamówieniami online, program lojalnościowy, kiosk samoobsługowy, '
        'panel operacyjny (POS), ekran kuchenny (KDS), moduł kasowo-fiskalny, edytor menu, moduł marketingowy, raportowanie '
        'oraz zarządzanie użytkownikami i uprawnieniami.',
        'Umowa nie obejmuje wykonywania nowych modułów, integracji, rozbudowy funkcji, większych poprawek ani innych prac '
        'indywidualnych. Prace takie mogą być realizowane wyłącznie na podstawie odrębnego uzgodnienia Stron w formie '
        'dokumentowej, określającego zakres, termin i wynagrodzenie.',
    ])
    s += par('§ 3. Wdrożenie i odbiór', [
        f'Wdrożenie nastąpi w terminie {B} dni od dnia zawarcia Umowy, pod warunkiem terminowego przekazania przez Licencjobiorcę '
        'informacji i dostępów wskazanych w ust. 2.',
        'Licencjobiorca zapewni dostęp do domeny, dane menu oraz inne informacje niezbędne do Wdrożenia.',
        'Wdrożenie nie obejmuje szkolenia personelu, konfiguracji ani instalacji sprzętu w lokalu Licencjobiorcy (w tym tabletów, '
        'kiosków, drukarek fiskalnych i sieci), chyba że Strony uzgodnią to odrębnie.',
        'W ramach Wdrożenia Licencjodawca udostępnia dostęp do konta Administratora osobie wskazanej przez Licencjobiorcę. '
        'Od tej chwili Administrator samodzielnie zarządza personelem w Systemie, w szczególności decyduje, komu i jakie konta '
        'oraz role (w tym rolę Szef/Kierownik) nadaje, zmienia lub odbiera.',
        'Po zakończeniu Wdrożenia Strony przeprowadzą testy odbiorcze według listy kontrolnej (Załącznik nr 1 pkt 18), '
        'uzupełnią pozostałe pozycje wykazu urządzeń fiskalnych zweryfikowanych z Systemem (Załącznik nr 3 pkt 6.1) oraz '
        'nieuzupełnione parametry kopii zapasowych (Załącznik nr 2 pkt 3.1), a następnie podpiszą protokół odbioru zawierający wyniki testów i dane kontaktowe do zgłoszeń. '
        'Licencjobiorca może zgłosić uwagi w terminie 7 dni; '
        'brak uwag oznacza odbiór bez zastrzeżeń. Uruchomienie produkcyjne Systemu jest równoznaczne z dokonaniem odbioru.',
    ])
    s += par('§ 4. Licencja i prawa autorskie', [
        'Licencjodawca oświadcza, że przysługują mu autorskie prawa majątkowe do Systemu w zakresie niezbędnym do udzielenia licencji, '
        'z zastrzeżeniem komponentów udostępnianych na licencjach otwartych, do których stosuje się warunki tych licencji.',
        'Licencjodawca udziela Licencjobiorcy <b>niewyłącznej</b>, niezbywalnej licencji na korzystanie z Systemu przez czas trwania '
        'Umowy, na terytorium Rzeczypospolitej Polskiej, na potrzeby prowadzonej przez Licencjobiorcę działalności gastronomicznej, '
        'na następujących polach eksploatacji: korzystanie z Systemu przez personel Licencjobiorcy za pośrednictwem przeglądarki '
        'i aplikacji panelu, udostępnianie funkcji klientowskich klientom Licencjobiorcy oraz instalowanie aplikacji panelu na '
        'urządzeniach Licencjobiorcy.',
        '<b>Autorskie prawa majątkowe do Systemu pozostają przy Licencjodawcy.</b> Umowa nie przenosi tych praw ani nie stanowi '
        'zgody na wykonywanie zależnego prawa autorskiego.',
        'Licencjobiorca nie otrzymuje kodu źródłowego Systemu, chyba że Strony uzgodnią inaczej w odrębnej umowie.',
        'Licencjobiorca nie jest uprawniony do udzielania sublicencji, przekazywania ani udostępniania Systemu osobom trzecim '
        '(poza zakresem ust. 2), a także do dekompilacji i modyfikacji Systemu, bez uprzedniej zgody Licencjodawcy wyrażonej '
        'w formie dokumentowej, z zastrzeżeniem przypadków dozwolonych bezwzględnie obowiązującymi przepisami.',
        'Treści, znaki towarowe, zdjęcia i Dane Licencjobiorcy pozostają własnością Licencjobiorcy.',
    ])
    s += par('§ 5. Utrzymanie i wsparcie techniczne', [
        'Licencjodawca udostępnia System z należytą starannością i dokłada starań, aby był on dostępny w sposób ciągły – przez '
        'całą dobę, każdego dnia. System działa na infrastrukturze profesjonalnych dostawców usług chmurowych i jest przeznaczony '
        'do pracy ciągłej.',
        'Strony przyjmują, że na działanie Systemu mogą wpływać okoliczności niezależne od Licencjodawcy, w szczególności awarie '
        'lub prace po stronie dostawców infrastruktury, łączy internetowych, sprzętu i oprogramowania Licencjobiorcy, a także siła '
        'wyższa. W razie awarii Licencjodawca podejmuje działania zmierzające do przywrócenia prawidłowego działania Systemu '
        'w rozsądnym zakresie i w miarę dostępnych możliwości, bez gwarantowanego terminu reakcji lub naprawy.',
        'Docelowe parametry poziomu usług (SLA) – dostępność na poziomie 99,0% w skali miesiąca, przywrócenie działania lub obejście '
        'awarii krytycznej w ciągu 30–60 minut od przyjęcia zgłoszenia w godzinach wsparcia, czasy podjęcia działań dla pozostałych '
        'zgłoszeń oraz wydajność – określa Załącznik nr 3 pkt 8. '
        'Mają one charakter celów, do których osiągnięcia Licencjodawca dokłada należytej staranności (zobowiązanie starannego '
        'działania, a nie rezultatu). Ich nieosiągnięcie nie stanowi samo w sobie niewykonania lub nienależytego wykonania Umowy '
        'i nie uprawnia do kar umownych, obniżenia wynagrodzenia ani odszkodowania. Strony nie ustalają gwarantowanego poziomu '
        'dostępności ani gwarantowanych czasów reakcji, obejścia lub naprawy. Licencjodawca nie jest zobowiązany do całodobowego monitorowania Systemu, pełnienia dyżurów, natychmiastowej interwencji '
        'ani przywrócenia działania Systemu w określonym czasie.',
        'Wsparcie techniczne obejmuje podstawową pomoc w rozsądnym zakresie, udzielaną drogą elektroniczną lub telefoniczną w dni '
        'robocze. Zgłoszenia rozpatrywane są w miarę możliwości, z uwzględnieniem docelowych czasów podjęcia działań z Załącznika nr 3 '
        'pkt 8.2, bez gwarantowanego terminu odpowiedzi i bez obowiązku natychmiastowego usunięcia Błędu.',
        'Aktualizacje bezpieczeństwa i poprawki Błędów mogą być dostarczane w miarę potrzeb i możliwości technicznych, bez '
        'gwarantowanego terminu ich wdrożenia.',
        'Licencjodawca nie jest zobowiązany do świadczenia w ramach wynagrodzenia miesięcznego bezpłatnych prac rozwojowych. '
        'Wsparcie nie obejmuje: ręcznej obsługi zamówień, stałego nadzoru operacyjnego nad pracą Systemu lub lokalu, szkoleń '
        'personelu, konfiguracji sprzętu Licencjobiorcy, nowych funkcji, modułów i integracji, większych poprawek ani innych prac '
        'wykraczających poza wyraźnie uzgodniony zakres. Prace takie mogą zostać wykonane na zasadach określonych w § 2 ust. 4.',
        'Postanowienia niniejszego paragrafu nie wyłączają ani nie ograniczają odpowiedzialności Licencjodawcy w zakresie, w jakim '
        'jej wyłączenie lub ograniczenie jest niedopuszczalne na mocy bezwzględnie obowiązujących przepisów prawa.',
    ])
    s += par('§ 6. Wynagrodzenie i rozliczenia', [
        f'Z tytułu udzielenia licencji i Utrzymania Licencjobiorca wypłaca Licencjodawcy miesięcznie kwotę <b>{FEE}</b>, '
        f'tj. kwotę przekazywaną przelewem na rachunek bankowy Licencjodawcy po dokonaniu przez Licencjobiorcę, jako płatnika, '
        'potrąceń wymaganych przepisami prawa.',
        'Wynagrodzenie brutto ustala się w takiej wysokości, aby po potrąceniach dokonywanych przez Licencjobiorcę jako płatnika '
        f'kwota wypłacana Licencjodawcy wynosiła 1000 zł miesięcznie. Według stanu prawnego na dzień zawarcia Umowy wynagrodzenie '
        f'brutto wynosi łącznie {B} zł, z czego:<br/>'
        f'a) wynagrodzenie z tytułu udzielenia licencji (§ 4) – {B} zł brutto,<br/>'
        f'b) wynagrodzenie z tytułu Utrzymania i wsparcia technicznego (§ 5) – {B} zł brutto.<br/>'
        'Kwoty brutto ustala Licencjobiorca jako płatnik, zgodnie z rzeczywistą kwalifikacją prawną każdej części wynagrodzenia. '
        'Strony nie przyjmują z góry określonej wysokości kosztów uzyskania przychodu; koszty te stosuje się wyłącznie w zakresie, '
        'w jakim spełnione są przesłanki wynikające z przepisów prawa.',
        f'Z tytułu Wdrożenia Licencjobiorca zapłaci jednorazowe wynagrodzenie w wysokości {B} zł netto / Wdrożenie jest objęte '
        'wynagrodzeniem miesięcznym (niepotrzebne skreślić).',
        'Licencjodawca oświadcza, że w dniu zawarcia Umowy jest osobą fizyczną nieprowadzącą działalności gospodarczej i nie jest '
        'zarejestrowanym podatnikiem VAT. Wynagrodzenie płatne jest na podstawie Umowy, bez wystawiania faktury, przelewem na rachunek '
        f'bankowy Licencjodawcy nr {B}, w terminie do {B} dnia miesiąca następującego po miesiącu, którego dotyczy.',
        'Licencjobiorca, jako płatnik, w zakresie wynikającym z przepisów prawa oblicza, pobiera i odprowadza należności '
        'publicznoprawne od wynagrodzenia, odrębnie dla każdej części określonej w ust. 2, oraz sporządza i przekazuje dokumenty '
        'wymagane od płatnika. Obowiązki te, a także należności finansowane przez płatnika z jego własnych środków, obciążają '
        'Licencjobiorcę i nie są przenoszone na Licencjodawcę.',
        'Obowiązki, które przepisy prawa nakładają bezpośrednio na Licencjodawcę jako podatnika (w szczególności rozliczenie '
        'roczne podatku dochodowego oraz ewentualna dopłata podatku wynikająca z łącznej wysokości jego dochodów), pozostają '
        'po stronie Licencjodawcy. Licencjodawca przekaże Licencjobiorcy informacje i oświadczenia niezbędne do prawidłowego '
        'wykonania obowiązków płatnika.',
        'W przypadku zmiany przepisów lub okoliczności wpływających na wysokość potrąceń kwota brutto ulega odpowiedniemu '
        'przeliczeniu, tak aby kwota wypłacana Licencjodawcy pozostała równa 1000 zł, chyba że Strony postanowią inaczej w aneksie.',
        'W przypadku zmiany statusu Licencjodawcy (np. rozpoczęcia działalności gospodarczej lub rejestracji jako podatnik VAT) '
        'Strony w dobrej wierze dostosują postanowienia niniejszego paragrafu, przy czym zmiana wysokości wynagrodzenia wymaga aneksu.',
        'Strony ustalają następujący podział kosztów usług zewnętrznych niezbędnych do działania Systemu:<br/>'
        f'a) hosting i udostępnianie aplikacji – koszt pokrywa: {B},<br/>'
        f'b) baza danych i kopie zapasowe – koszt pokrywa: {B},<br/>'
        f'c) wysyłka wiadomości e-mail – koszt pokrywa: {B},<br/>'
        f'd) inne usługi ({B}) – koszt pokrywa: {B}.<br/>'
        f'Wynagrodzenie miesięczne, o którym mowa w ust. 1, obejmuje następujące usługi: {B}.<br/>'
        f'Sposób rozliczania kosztów ponoszonych przez Licencjobiorcę: {B}.<br/>'
        'Koszt domeny ponosi Licencjobiorca jako jej abonent. Koszty usług ponadstandardowych mogą być przenoszone na '
        'Licencjobiorcę wyłącznie po uprzednim uzgodnieniu.',
        'Prace, o których mowa w § 2 ust. 4, oraz dodatkowa pomoc wykraczająca poza § 5 rozliczane są według wynagrodzenia '
        'uzgodnionego odrębnie przed ich rozpoczęciem.',
    ])
    s += par('§ 7. Obowiązki Stron', [
        'Licencjodawca zobowiązuje się wykonywać Umowę z należytą starannością, zgodnie z aktualną wiedzą techniczną.',
        'Licencjobiorca zobowiązuje się korzystać z Systemu zgodnie z przeznaczeniem i Umową, chronić dane logowania oraz '
        'niezwłocznie informować o nieprawidłowościach.',
        'Licencjobiorca, za pośrednictwem Administratora, samodzielnie zarządza kontami i uprawnieniami swojego personelu '
        'i decyduje o ich przydzielaniu, zmianie i odbieraniu, w tym o nadaniu roli Szef/Kierownik. Licencjodawca nie ingeruje '
        'w organizację pracy personelu Licencjobiorcy i nie odpowiada za decyzje Licencjobiorcy w tym zakresie.',
        'Licencjobiorca odpowiada za prawidłowość wprowadzanych danych, treści i cen, stawek VAT, informacji o alergenach oraz za '
        'zgodność własnej działalności z przepisami prawa, w tym przepisami podatkowymi, fiskalnymi i konsumenckimi.',
        'Licencjobiorca zapewnia sprawne urządzenia, drukarki fiskalne, oprogramowanie i łącze internetowe w lokalu. '
        'Licencjodawca deklaruje współpracę Systemu z drukarkami fiskalnymi ujętymi w wykazie urządzeń zweryfikowanych '
        '(Załącznik nr 3 pkt 6.1); weryfikacja innych urządzeń odbywa się na zasadach § 2 ust. 4.',
    ])
    s += par('§ 8. Ochrona danych osobowych', [
        'Licencjobiorca jest administratorem danych osobowych klientów i personelu przetwarzanych w Systemie.',
        'Licencjobiorca powierza Licencjodawcy przetwarzanie danych osobowych w zakresie niezbędnym do wykonania Umowy, na zasadach '
        'określonych w umowie powierzenia przetwarzania danych osobowych stanowiącej Załącznik nr 4. Przetwarzanie danych w ramach '
        'Umowy rozpoczyna się z chwilą podpisania Załącznika nr 4.',
        'Licencjodawca stosuje środki techniczne i organizacyjne opisane w Załącznikach nr 2 i nr 4.',
        'Licencjodawca może korzystać z dalszych podmiotów przetwarzających (dostawców infrastruktury) na zasadach określonych w Załączniku nr 4.',
    ])
    s += par('§ 9. Poufność', [
        'Strony zobowiązują się zachować w poufności informacje uzyskane w związku z Umową, w tym informacje techniczne o Systemie '
        'oraz dane handlowe Licencjobiorcy.',
        'Obowiązek poufności trwa w okresie obowiązywania Umowy oraz 3 lata po jej zakończeniu.',
    ])
    s += par('§ 10. Odpowiedzialność', [
        'Łączna odpowiedzialność Licencjodawcy z tytułu Umowy ograniczona jest do szkody rzeczywistej i do wysokości wynagrodzenia '
        'zapłaconego Licencjodawcy za ostatnie 12 miesięcy przed zdarzeniem wyrządzającym szkodę.',
        'Licencjodawca nie odpowiada za utracone korzyści ani za przerwy i nieprawidłowości wynikające z awarii lub działania dostawców '
        'zewnętrznych, łączy internetowych, sprzętu lub oprogramowania Licencjobiorcy, działań osób trzecich, siły wyższej ani innych '
        'okoliczności pozostających poza jego kontrolą.',
        'Licencjodawca nie odpowiada za skutki decyzji i działań personelu Licencjobiorcy, w tym za przydzielanie kont i uprawnień, '
        'udostępnianie danych logowania oraz operacje wykonane w Systemie przez personel Licencjobiorcy.',
        'Licencjodawca nie odpowiada za treści i dane wprowadzane do Systemu przez Licencjobiorcę, jego personel lub klientów.',
        'Licencjodawca nie gwarantuje osiągnięcia przez Licencjobiorcę określonego poziomu sprzedaży, zysków ani innych korzyści biznesowych.',
        'Ograniczenia odpowiedzialności przewidziane w niniejszym paragrafie nie dotyczą szkody wyrządzonej umyślnie ani innych '
        'przypadków, w których wyłączenie lub ograniczenie odpowiedzialności jest niedopuszczalne na podstawie bezwzględnie '
        'obowiązujących przepisów prawa.',
    ])
    s += par('§ 11. Czas trwania i rozwiązanie', [
        f'Umowa zostaje zawarta na czas nieokreślony / określony do dnia {B} (niepotrzebne skreślić).',
        'Każda ze Stron może wypowiedzieć Umowę z zachowaniem jednomiesięcznego okresu wypowiedzenia ze skutkiem na koniec miesiąca kalendarzowego.',
        'Strona może rozwiązać Umowę bez wypowiedzenia w przypadku istotnego naruszenia jej postanowień przez drugą Stronę '
        'i bezskutecznego upływu 14-dniowego terminu na usunięcie naruszenia, wyznaczonego w formie dokumentowej.',
        'Po zakończeniu Umowy Licencjodawca, na żądanie Licencjobiorcy zgłoszone w terminie 30 dni, jednorazowo przekaże Dane '
        'Licencjobiorcy w powszechnie używanym formacie elektronicznym, a następnie je usunie, zgodnie z Załącznikiem nr 4.',
        'Migracja danych do innego systemu, przekształcanie danych oraz inna dodatkowa pomoc przy zakończeniu współpracy mogą być '
        'odpłatne, jeżeli Strony nie uzgodnią inaczej.',
    ])
    s += par('§ 12. Postanowienia końcowe', [
        'Zmiany Umowy wymagają formy pisemnej lub dokumentowej pod rygorem nieważności.',
        'W sprawach nieuregulowanych stosuje się przepisy Kodeksu cywilnego, ustawy o prawie autorskim i prawach pokrewnych '
        'oraz RODO.',
        'Spory rozstrzygać będzie sąd powszechny właściwy według przepisów ogólnych.',
        'Integralną część Umowy stanowią załączniki wymienione poniżej. W razie sprzeczności pierwszeństwo ma treść Umowy.',
        'Umowę sporządzono w dwóch jednobrzmiących egzemplarzach, po jednym dla każdej ze Stron.',
    ])
    s += [sec('Załączniki'),
          ul(['Załącznik nr 1 – Specyfikacja funkcjonalna systemu',
              'Załącznik nr 2 – Bezpieczeństwo i ochrona danych',
              'Załącznik nr 3 – Architektura techniczna i informacje o dostępności systemu',
              'Załącznik nr 4 – Umowa powierzenia przetwarzania danych osobowych']),
          sp(40)]
    sig = Table([[Paragraph('……………………………………<br/>Licencjodawca', S['cell']), Paragraph('……………………………………<br/>Licencjobiorca', S['cell'])]],
                colWidths=[CONTENT_W / 2] * 2)
    sig.setStyle(TableStyle([('ALIGN', (0, 0), (-1, -1), 'CENTER')]))
    s += [sig]
    return s


if __name__ == '__main__':
    build('../00_Umowa_wdrozenia_licencji_i_utrzymania.pdf', 'Umowa wdrożenia, licencji i utrzymania', 'Umowa',
          'Umowa wdrożenia,\nlicencji i utrzymania', 'Umowa wraz z załącznikami technicznymi', story())
