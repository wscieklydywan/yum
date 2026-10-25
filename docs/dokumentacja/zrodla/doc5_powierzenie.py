from lib import *

B = '…………………………………'


def par(title, points):
    return [sec(title), ol(points)]


def story():
    s = [h1('Umowa powierzenia przetwarzania danych osobowych'),
         p('zawarta w związku z Umową wdrożenia, licencji i utrzymania systemu (dalej „<b>Umowa główna</b>”) pomiędzy:'),
         p(f'<b>{CLIENT["name"]}</b>, {CLIENT["address"]}, NIP {CLIENT["nip"]} – jako administratorem danych, zwanym dalej „<b>Administratorem danych</b>”,'),
         p('a'),
         p(f'<b>{B}</b>, zamieszkałym/-ą w {B} – Licencjodawcą, jako podmiotem przetwarzającym, zwanym dalej „<b>Przetwarzającym</b>”.')]

    s += par('§ 1. Przedmiot i czas przetwarzania', [
        'Administrator danych powierza Przetwarzającemu, w trybie art. 28 RODO, przetwarzanie danych osobowych w zakresie i celu '
        'niezbędnym do wykonania Umowy głównej (udostępnianie Systemu, Utrzymanie, wsparcie techniczne).',
        'Przetwarzanie trwa przez okres obowiązywania Umowy głównej oraz okres niezbędny do zwrotu i usunięcia danych.',
    ])
    s += [sec('§ 2. Charakter, kategorie osób i danych'),
          table([['Kategoria osób', 'Kategorie danych'],
                 ['Klienci (zamówienia online, kiosk)', 'Imię, adres e-mail, numer telefonu, adres dostawy, treść i historia zamówień, NIP nabywcy (jeśli podany)'],
                 ['Członkowie Yummy Club', 'Dane konta, saldo gwiazdek, poziom, kupony i nagrody, historia zamówień'],
                 ['Personel Administratora danych', 'Imię i nazwisko, adres e-mail, rola w Systemie, historia operacji w panelu']], [0.32, 0.68]),
          p('Operacje przetwarzania: przechowywanie, utrwalanie, porządkowanie, udostępnianie upoważnionym użytkownikom, tworzenie kopii '
            'zapasowych, usuwanie. Przetwarzanie nie obejmuje szczególnych kategorii danych (art. 9 RODO).')]
    s += par('§ 3. Obowiązki Przetwarzającego', [
        'Przetwarzający przetwarza dane wyłącznie na udokumentowane polecenie Administratora danych; za takie polecenie uznaje się Umowę główną i niniejszą umowę.',
        'Przetwarzający zapewnia, że osoby upoważnione do przetwarzania zobowiązały się do zachowania poufności.',
        'Przetwarzający stosuje środki techniczne i organizacyjne, o których mowa w art. 32 RODO, opisane w Załączniku nr 2 do Umowy głównej.',
        'Przetwarzający, w miarę możliwości i uwzględniając charakter przetwarzania, pomaga Administratorowi danych w wywiązywaniu się '
        'z obowiązku odpowiadania na żądania osób, których dane dotyczą, oraz z obowiązków określonych w art. 32–36 RODO.',
        'Przetwarzający udostępnia informacje niezbędne do wykazania spełnienia obowiązków z art. 28 RODO i umożliwia przeprowadzenie '
        'audytów lub inspekcji, po uprzednim uzgodnieniu terminu i zakresu. Koszty audytu ponosi Administrator danych, chyba że Strony uzgodnią inaczej.',
    ])
    s += par('§ 4. Naruszenia ochrony danych', [
        'Przetwarzający zgłasza Administratorowi danych stwierdzone naruszenie ochrony danych osobowych bez zbędnej zwłoki, '
        'nie później niż w ciągu 72 godzin od stwierdzenia naruszenia (art. 33 ust. 2 RODO).',
        'Zgłoszenie zawiera informacje dostępne Przetwarzającemu, niezbędne Administratorowi danych do oceny naruszenia i ewentualnego '
        'zgłoszenia go organowi nadzorczemu.',
    ])
    s += [sec('§ 5. Dalsze podmioty przetwarzające'),
          p('Administrator danych wyraża ogólną zgodę na korzystanie przez Przetwarzającego z dalszych podmiotów przetwarzających. '
            'Przetwarzający informuje Administratora danych o zamierzonych zmianach, dając mu możliwość wyrażenia sprzeciwu. '
            'W Systemie wykorzystywane są następujące kategorie dalszych podmiotów przetwarzających:'),
          table([['Kategoria usługi', 'Zakres'],
                 ['Infrastruktura bazy danych i przechowywania plików', 'Przechowywanie danych Systemu, uwierzytelnianie, kopie zapasowe. '
                  'Baza danych Systemu znajduje się na terenie Unii Europejskiej.'],
                 ['Hosting aplikacji', 'Obsługa żądań aplikacji, logi techniczne'],
                 ['Usługa wysyłki wiadomości e-mail', 'Wysyłka wiadomości e-mail do klientów i personelu'],
                 ['Usługa geokodowania adresów', 'Ustalanie lokalizacji adresu dostawy'],
                 ['Usługi powiadomień push', 'Dostarczanie powiadomień do urządzeń personelu']], [0.4, 0.6]),
          p('Przetwarzający nakłada na dalsze podmioty przetwarzające obowiązki ochrony danych odpowiadające obowiązkom wynikającym '
            'z niniejszej umowy (art. 28 ust. 4 RODO) i pozostaje wobec Administratora danych w pełni odpowiedzialny za ich działania. '
            'Przetwarzający samodzielnie dobiera, organizuje i utrzymuje infrastrukturę Systemu.'),
          p('Szczegółowe dane identyfikujące dalsze podmioty przetwarzające stanowią tajemnicę przedsiębiorstwa Przetwarzającego '
            'i informację poufną w rozumieniu Umowy głównej. Są one udostępniane Administratorowi danych wyłącznie na jego żądanie, '
            'w formie dokumentowej, w zakresie niezbędnym do realizacji obowiązków wynikających z RODO. Administrator danych nie '
            'ujawnia tych informacji osobom trzecim, z wyjątkiem organu nadzorczego lub innych podmiotów uprawnionych na podstawie '
            'przepisów prawa. W informacjach kierowanych do osób, których dane dotyczą (np. w polityce prywatności), Administrator '
            'danych może posługiwać się kategoriami odbiorców wskazanymi w tabeli powyżej.'),
          p('W razie przekazywania danych poza Europejski Obszar Gospodarczy stosowane będą mechanizmy przewidziane w rozdziale V RODO '
            '(np. decyzja stwierdzająca odpowiedni stopień ochrony lub standardowe klauzule umowne).')]
    s += par('§ 6. Zakończenie przetwarzania', [
        'Po zakończeniu świadczenia usług Przetwarzający, zgodnie z decyzją Administratora danych, zwraca dane w powszechnie używanym '
        'formacie elektronicznym lub je usuwa oraz usuwa wszelkie ich istniejące kopie, chyba że prawo nakazuje ich dalsze przechowywanie.',
        'Kopie zapasowe prowadzone przez dostawców infrastruktury usuwane są zgodnie z cyklem ich retencji (7 dni).',
        'Migracja danych do innego systemu wykracza poza obowiązek z ust. 1 i może być odpłatna zgodnie z Umową główną.',
    ])
    s += par('§ 7. Odpowiedzialność i postanowienia końcowe', [
        'Odpowiedzialność Stron określają przepisy RODO, w szczególności art. 82, oraz Umowa główna w zakresie, w jakim jest to dopuszczalne.',
        'Umowa wchodzi w życie z dniem podpisania i obowiązuje przez czas obowiązywania Umowy głównej.',
        'W sprawach nieuregulowanych stosuje się przepisy RODO, ustawy o ochronie danych osobowych oraz Kodeksu cywilnego.',
    ])
    s += [sp(40)]
    sig = Table([[Paragraph('……………………………………<br/>Przetwarzający (Licencjodawca)', S['cell']),
                  Paragraph('……………………………………<br/>Administrator danych (Licencjobiorca)', S['cell'])]],
                colWidths=[CONTENT_W / 2] * 2)
    sig.setStyle(TableStyle([('ALIGN', (0, 0), (-1, -1), 'CENTER')]))
    s += [sig]
    return s


if __name__ == '__main__':
    build('../04_Umowa_powierzenia_przetwarzania_danych.pdf', 'Umowa powierzenia przetwarzania danych', 'Załącznik nr 4 do Umowy',
          'Umowa powierzenia\nprzetwarzania danych', 'Zasady przetwarzania danych osobowych w Systemie (art. 28 RODO)\nZałącznik nr 4 do Umowy', story())
