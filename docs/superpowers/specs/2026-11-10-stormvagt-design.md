# Stormvagt: design

Dato: 2026-11-10. Godkendt i chatten af Tom.

## Formål

Et originalt co-op-spil for 2–4 venner, der spiller online i browseren på hver sin pc. I skal holde et fyrtårn tændt gennem en stormnat og få skibene sikkert i havn. Spillet skal være let at gå til, kræve snak og samarbejde, og føles hektisk på den sjove måde.

Succes betyder, at en gruppe kan gå fra link til spil på under to minutter, og at alle fem nætter kan spilles og vindes.

## Valg truffet med Tom

- Online på hver sin pc via en lille cloud-server, ligesom Skillet Scrap.
- 2D pixelkunst.
- Fem nætter, der bliver sværere.
- Alle spillere kan alle opgaver. Der er ingen faste roller.
- Spillets tekst er på dansk.

## Antagelser

- Tastatur i browseren. Ingen gamepad i første version.
- Spillet kræver 2–4 spillere.
- Spillerne snakker sammen via deres egen stemmechat. Spillet har ingen chat.
- Fremskridt huskes i browseren hos den, der opretter rummet.

## Styring

| Tast | Handling |
|---|---|
| A/D eller ←/→ | Gå |
| W/S eller ↑/↓ | Klatre op og ned ad stigen, når man står ved den |
| Mellemrum | Samle op eller lægge fra sig, og holde nede for at bruge en station |

Man bærer højst én ting ad gangen: en oliekande (tom eller fuld) eller et bræt. Mellemrum ved en station med en ting i hånden bruger tingen. Mellemrum uden en station i nærheden lægger tingen på gulvet.

## Verden

- Fyrtårnet ses fra siden, skåret igennem som et dukkehus, med havet på begge sider.
- Pixelkunsten tegnes i 320×180 og skaleres op i hele pixel, så den er skarp.
- Fire etager forbundet af én stige i midten:

| Etage | Stationer |
|---|---|
| **Lanternerum** (øverst) | Lampen (oliemåler) og linsen med et håndsving i hver side. 2 ruder. |
| **Værksted** | Brætstabel med uendelig forsyning. 2 ruder. |
| **Olielager** | Olietønder, hvor kanden fyldes. 2 ruder. |
| **Kælder** | Pumpe. Vandstanden ses som stigende vand. |

- Spillerne kan gå igennem hinanden, og ingen kan dø.
- Oliekanderne ligger fra start i olielageret, én pr. spiller.

## Systemer

**Lampe**
- Olie går fra 0 til 100, og lampen er tændt, så længe olien er over 0.
- Den bruger 1 pr. sekund. Hver knust rude i lanternerummet øger forbruget med 50 %.
- En fuld kande giver +50, når man holder mellemrum ved lampen i 1 sekund.

**Oliekande**
- Kanden fyldes ved tønderne ved at holde mellemrum i 1,5 sekund.
- Det kan kun lade sig gøre, mens olielageret ikke er oversvømmet.

**Linse**
- Linsen peger enten mod venstre eller mod højre.
- Man drejer den ved at holde mellemrum ved håndsvinget i den side, man vil dreje mod, i 2 sekunder.
- Et lyn kan få linsen til at sætte sig fast. Så skal den repareres med et bræt: hold mellemrum ved linsen i 3 sekunder.

**Skibe**
- Skibene dukker op ved horisonten til venstre eller højre efter nattens plan.
- Et skib er **oplyst**, når lampen er tændt, og linsen peger mod dets side uden at sidde fast.
- Oplyst: skibets fremskridt stiger fra 0 til 100 over 20 sekunder. Ved 100 er det i havn.
- Ikke oplyst: skibets fare stiger fra 0 til 100 over 25 sekunder. Ved 100 forliser det på klipperne.
- Fare falder ikke igen, men stiger kun, mens skibet er uden lys.
- Flere skibe kan være på vej samtidig, også i begge sider. Så må holdet vælge og skifte.

**Ruder** (fra nat 2)
- Stormen knuser tilfældige ruder efter nattens plan.
- En rude repareres ved at holde mellemrum ved den med et bræt i 2 sekunder. Brættet bruges op.
- Hver knust rude på værkstedet eller i olielageret får vand til at løbe ind i kælderen.

**Vand** (fra nat 3)
- Vandstanden går fra 0 til 100 og stiger med en fast grundmængde pr. sekund plus et tillæg for hver knust rude længere nede.
- Hver spiller, der holder mellemrum ved pumpen, sænker vandet med en fast mængde pr. sekund.
- Ved 60 eller mere er olielageret oversvømmet, så kanden kan ikke fyldes, og man går langsommere i kælderen og olielageret.

**Lyn** (fra nat 4)
- Lynnedslag sker efter nattens plan. Ved et nedslag blinker skærmen, og linsen sætter sig fast.

## Nætter

| Nat | Nyt | Skibe ved 2 spillere |
|---|---|---|
| 1 | Kun lampe og linse | 4 |
| 2 | Ruderne knuser | 5 |
| 3 | Kælderen oversvømmes | 6 |
| 4 | Lynnedslag | 7 |
| 5 | Det hele, med tættere pres | 8 |

- Hver ekstra spiller giver +1 skib og hyppigere ruder, vand og lyn. Det fastsættes, når natten starter.
- En nat varer omkring 6–10 minutter.
- Det bliver daggry, når nattens sidste skib er enten i havn eller forlist. I vinder natten, hvis højst 2 skibe er forlist.
- I taber natten med det samme, når det 3. skib forliser.
- Alle tal ligger samlet ét sted, så sværhedsgraden kan finjusteres.

## Rum og forløb

1. **Forside:** skriv et navn, og vælg **Opret rum** eller **Deltag** med en kode.
2. Et rum får en kode på 4 bogstaver og har plads til højst 4 spillere.
3. **Lobby:** viser koden, spillerne og et kort "Sådan spiller I". Opretteren vælger en nat blandt dem, opretterens browser har låst op. Nat 1 er altid åben. Start kræver mindst 2 spillere.
4. Der tælles ned fra 3, og så starter natten.
5. **Resultat:** vundet eller tabt, skibe i havn og forliste skibe. Opretteren kan vælge **Næste nat** (efter en sejr), **Prøv igen** eller **Tilbage til lobbyen**.
6. Når en nat vindes, låser opretterens browser næste nat op.

Fejl og afbrydelser:
- Ukendt kode, fuldt rum eller et rum midt i en nat giver en tydelig besked på forsiden.
- Hvis en spiller forlader spillet midt i en nat, fortsætter natten med de resterende, og de andre får besked. Hvis alle forlader rummet, slettes det.
- Hvis opretteren forlader rummet, bliver den næste spiller opretter.
- Mistet forbindelse giver en besked og en knap tilbage til forsiden. Man kan ikke vende tilbage midt i en nat.
- Mens en gratis server vågner, viser siden "Vækker serveren…" i stedet for en fejl.

## Opbygning

- Samme opbygning som Skillet Scrap: ét Node.js-program uden byggetrin, med `ws` som eneste afhængighed.
- Serveren kører spillet 30 gange i sekundet og sender tilstanden cirka 20 gange i sekundet. Browserne sender kun tasternes tilstand og blander mellem tilstande, så bevægelsen ser jævn ud.
- Spillereglerne er ren kode uden netværk og tid, så de kan testes direkte.
- Rum, lobby, forbindelse og tastaturkode tages fra Skillet Scrap og tilpasses. Spillevalg erstattes af natvalg.
- Grafik og lyd laves i kode og er originale.

## Test

- **Automatiske test af reglerne:** olieforbrug, påfyldning, linse, oplyste og uoplyste skibe, i havn og forlis, ruder og vand, oversvømmet olielager, lyn, nattens slut og sejr eller nederlag, skalering efter antal spillere.
- **Automatiske test af rum og server:** koder, fulde rum, natvalg, at mindst 2 spillere kræves, overdragelse af opretter, at en spiller forlader midt i en nat, og ødelagte beskeder.
- **Gennemspilning:** alle fem nætter med scriptede spillere mod den rigtige server, med 2, 3 og 4 spillere. Mindst én nat ses i en rigtig browser.
- **Online:** det rigtige spil over internettet testes, når det er lagt ud.

## Hosting

En ny gratis Render-tjeneste med koden på GitHub, ligesom Skillet Scrap. README giver trin-for-trin-vejledning, og `start-spil.bat` starter spillet lokalt.

## Uden for denne version

Gamepad, computerstyrede spillere, at vende tilbage midt i en nat, konti, ranglister, chat, flere end fem nætter og musik.
