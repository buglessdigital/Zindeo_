# Course document figures

Mermaid sources (`*.mmd`) and the PNGs embedded in the course documents.

Re-render after editing a `.mmd` file (uses the local Chrome):

```sh
npx -p @mermaid-js/mermaid-cli@12.0.0 mmdc -i fig-x.mmd -o fig-x.png \
  -c mermaid-config.json -p puppeteer.json -b white -s 3
```

`puppeteer.json`: `{"executablePath":"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"}`
