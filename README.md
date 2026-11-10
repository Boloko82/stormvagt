# Stormvagt

## Hvad er det?

Et co-op-spil for 2 til 4 venner, hver i sin egen browser. I er fyrvogtere en stormnat og skal holde lyset tændt, så skibene finder sikkert i havn.

Spillet ligger i mappen **Stormvagt** i din **Dokumenter\Jette\Projects**-mappe.

## Sådan spiller I

| Tast | Hvad den gør |
|---|---|
| A/D eller ←/→ | Gå |
| W/S eller ↑/↓ | Klatre op og ned ad stigen |
| Mellemrum | Saml op eller læg fra dig. Hold nede for at bruge en station. |
| M | Lyd til eller fra |

1. Én skriver et navn og klikker **Opret rum**. Vedkommende får en kode på 4 bogstaver.
2. De andre skriver deres navn og koden og klikker **Deltag**.
3. Den, der oprettede rummet, vælger en nat og trykker **Start**. I skal være mindst 2.

**Natten**
- Skibe kommer ind fra venstre og højre. Et skib sejler kun i havn, når lampen brænder, og linsen peger mod dets side. Den grønne streg over skibet viser, hvor langt det er nået, og den røde viser faren.
- Tre forliste skibe, og natten er tabt. Når alle skibe er i havn eller forlist, bliver det daggry, og så har I vundet.
- Alle kan alt. Snak sammen, og fordel opgaverne.

**Tårnet**
- **Lanternerum** (øverst): hold mellemrum ved lampen med en fuld oliekande for at fylde på. Hold mellemrum ved håndsvinget i venstre eller højre side for at dreje linsen derhen.
- **Værksted:** tag et bræt fra stablen. Et bræt lapper en knust rude, eller får en linse, der sidder fast efter et lyn, til at virke igen.
- **Olielager:** fyld oliekanden ved tønderne.
- **Kælder:** hold mellemrum ved pumpen. Hvis vandet når olielageret, kan I ikke fylde olie, før der er pumpet.

**Fem nætter**
1. Kun lampe og linse.
2. Ruderne begynder at knuse.
3. Kælderen fyldes med vand.
4. Lynnedslag sætter linsen fast.
5. Det hele på én gang.

Når I vinder en nat, låses den næste op i jeres browsere. Fremskridtet gemmes i browseren, så på en anden pc eller i et privat vindue starter man fra nat 1.

## Start spillet på din pc

1. Installer **Node.js** én gang: gå til https://nodejs.org, hent **LTS**-versionen, og installer den med standardvalgene.
2. Åbn mappen **Stormvagt**, og dobbeltklik på **start-spil.bat**.
   - Første gang henter den en lille tilføjelse, så den skal have internet.
   - Din browser åbner på http://localhost:3000. Hvis ikke, skriv adressen selv.
   - Lad det sorte vindue være åbent, mens I spiller. Lukker du det, stopper spillet.
3. Vil du prøve alene, så åbn http://localhost:3000 i en ekstra fane, og deltag i dit eget rum.

**Venner på samme wifi** kan deltage direkte hos dig. Det sorte vindue viser din pc's adresse, for eksempel `http://192.168.1.20:3000`, og den skriver de i deres browser. Første gang spørger Windows måske, om Node.js må bruge netværket. Sæt flueben ved **Private netværk**, og klik **Tillad**.

## Spil med venner online

Til venner andre steder kan du lægge spillet gratis online. Du skal bruge to gratis konti: **GitHub** (gemmer filerne) og **Render** (kører spillet). Du har dem måske allerede fra Skillet Scrap. Første gang tager det omkring 15 minutter.

**A. Læg filerne på GitHub**

1. Gå til https://github.com, og log ind.
2. Klik på **+** øverst til højre og så **New repository**. Kald det `stormvagt`, lad det være **Public**, og klik **Create repository**.
3. Klik på linket **uploading an existing file** på den nye side.
4. Marker alt i mappen Stormvagt **undtagen mappen `node_modules`**, og træk det ind i browservinduet. Kan du se en fil, der hedder `.gitignore`, så tag den med. Det gør ikke noget, hvis du ikke kan.
5. Når uploaden er færdig, klikker du **Commit changes**. Tjek, at `public`, `server`, `package.json` og `render.yaml` står på listen.

**B. Kør det på Render**

1. Gå til https://render.com, og log ind med **GitHub**.
2. Klik **New** og så **Blueprint**, og vælg dit `stormvagt`-repository. Klik **Connect**, hvis den spørger.
3. Render læser `render.yaml` og viser én gratis webtjeneste, der hedder `stormvagt`. Klik **Apply** eller **Deploy Blueprint**.
   - Er der ingen Blueprint-mulighed, så brug **New** > **Web Service**, vælg repositoryet, og udfyld: Language **Node**, Build Command `npm install`, Start Command `npm start`, Instance Type **Free**. Klik så **Create Web Service**.
4. Vent et par minutter, til der står **Live**. Linket, der ender på **onrender.com**, øverst på siden er dit spil. Send det til dine venner.

Den gratis plan falder i søvn efter omkring 15 minutter uden spillere. Næste besøg vækker den, og det tager omkring et minut. Siden indlæser måske bare langsomt, eller Render viser sin egen indlæsningsside først. Vent, og genindlæs siden, hvis spillet ikke er kommet efter et minuts tid.

Hvis du ændrer spillet senere, uploader du de ændrede filer til GitHub på samme måde. Render opdaterer spillet af sig selv få minutter efter.

## Fejlfinding

- **Første besøg er langsomt, eller Render viser sin egen indlæsningsside (eller "Vækker serveren…")**: det er normalt på den gratis plan efter en stille periode. Giv det et minut, og genindlæs siden, hvis det er nødvendigt.
- **"Forbindelsen til serveren blev afbrudt"**: serveren genstartede, eller internettet faldt ud. Gå tilbage til forsiden, og opret eller deltag i et rum igen. En nat i gang kan ikke genoptages.
- **"Der er intet rum med den kode"**: tjek de 4 bogstaver med den, der oprettede rummet. Store og små bogstaver og mellemrum er ligegyldige. Et rum forsvinder, når alle har forladt det.
- **"Rummet er i gang med en nat"**: vent, til de er tilbage i lobbyen, og deltag så.
- **"Rummet er fuldt"**: et rum har plads til 4 vogtere.
- **En nat er grå i lobbyen**: den låses op, når den foregående nat er klaret i den browser, der vælger natten.
- **Venner på jeres wifi kan ikke forbinde**: de skal bruge adressen fra det sorte vindue (ikke `localhost`), være på samme netværk, og Node.js skal have lov gennem firewallen. Startmenu > "Tillad en app gennem Windows Firewall" > find **Node.js**, og sæt flueben ved **Privat**.
- **start-spil.bat siger, at Node.js ikke er installeret**: installer Node.js LTS fra https://nodejs.org, genstart pc'en, og prøv igen.
- **"EADDRINUSE" i det sorte vindue**: spillet kører allerede i et andet vindue. Brug det, eller luk det først.
- **Ingen lyd**: klik én gang et sted på siden (browsere holder lyden slukket, til man har gjort det), og tjek knappen **Lyd til**.
