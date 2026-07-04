# Licensing

This project contains two very different kinds of material — **code** and
**game content** — under different licenses, plus a strict policy for
content the plugin does *not* ship.

## 1. Code — MIT

All source code in this repository (TypeScript/JavaScript, CSS, build
configuration) is licensed under the MIT License:

> Copyright (c) 2026 Mehras Meydani
>
> Permission is hereby granted, free of charge, to any person obtaining a
> copy of this software and associated documentation files (the
> "Software"), to deal in the Software without restriction, including
> without limitation the rights to use, copy, modify, merge, publish,
> distribute, sublicense, and/or sell copies of the Software, and to
> permit persons to whom the Software is furnished to do so, subject to
> the following conditions:
>
> The above copyright notice and this permission notice shall be included
> in all copies or substantial portions of the Software.
>
> THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
> OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
> MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.
> IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY
> CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT,
> TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE
> SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.

## 2. Bundled game content — SRD, CC-BY-4.0

The game data bundled with the plugin (`src/data/content/srd/`) is
derived exclusively from Wizards of the Coast's System Reference
Documents, used under the Creative Commons Attribution 4.0 International
License. Required attribution:

> This work includes material from the System Reference Document 5.1
> ("SRD 5.1") by Wizards of the Coast LLC and available at
> https://dnd.wizards.com/resources/systems-reference-document. The
> SRD 5.1 is licensed under the Creative Commons Attribution 4.0
> International License available at
> https://creativecommons.org/licenses/by/4.0/legalcode.

> This work includes material from the System Reference Document 5.2
> ("SRD 5.2") by Wizards of the Coast LLC and available at
> https://dnd.wizards.com/resources/systems-reference-document. The
> SRD 5.2 is licensed under the Creative Commons Attribution 4.0
> International License available at
> https://creativecommons.org/licenses/by/4.0/legalcode.

The SRDs deliberately include only a subset of published D&D material
(for example, one subclass per class). That subset is the ceiling for
what this plugin may bundle.

Content fetched by the optional **"Refresh 5e content from Open5e"**
command is limited to SRD-licensed documents (`document__slug=wotc-srd`)
served by the [Open5e](https://open5e.com) API, under the same CC-BY
terms.

## 3. User-imported content — not ours, not shipped

The **"Import 5etools data"** command converts JSON files that *you*
supply into content bundles stored inside your own vault's plugin
folder. This material:

- is never bundled with, uploaded by, or redistributed through the
  plugin or this repository;
- remains subject to its own copyright (typically Wizards of the Coast);
- is imported **at your own risk and responsibility** — only import
  material you legally own, and do not share the generated bundle files.

The plugin authors accept no responsibility for content users import.

The same policy applies to development reference data: raw 5etools JSON
under `docs/reference/5etools/` is git-ignored and local-only, and must
never be committed or shipped (see `docs/reference/README.md`).

## 4. Trademarks

Dungeons & Dragons, D&D, and their respective logos are trademarks of
Wizards of the Coast LLC. This project is unaffiliated fan tooling and
claims no rights to them.
