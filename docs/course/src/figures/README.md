# Course document figures

Mermaid sources (`*.mmd`) and the PNGs embedded in the course documents.

Re-render after editing a `.mmd` file (uses the local Chrome):

```sh
npx -p @mermaid-js/mermaid-cli@12.0.0 mmdc -i fig-x.mmd -o fig-x.png \
  -c mermaid-config.json -p puppeteer.json -b white -s 3
```

`puppeteer.json`: `{"executablePath":"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"}`

## UML figures (`uml/`)

PlantUML sources (`*.puml`) for RSD Revision 2.0; all include the shared style `uml/style.iuml`.
File prefixes: `uc-` use case, `ad-` activity, `sd-` sequence, `cd-` class, `sm-` state machine.

Re-render after editing a `.puml` file (needs Java and Graphviz, e.g. `brew install graphviz`):

```sh
GRAPHVIZ_DOT=$(which dot) java -Djava.awt.headless=true -DPLANTUML_LIMIT_SIZE=16384 \
  -jar plantuml-1.2025.4.jar -tpng uml/*.puml
```

`plantuml-1.2025.4.jar`: https://repo1.maven.org/maven2/net/sourceforge/plantuml/plantuml/1.2025.4/
