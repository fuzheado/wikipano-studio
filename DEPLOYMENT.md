# Deployment Guide – Wikimedia Photosphere Tours

## Overview

This document provides step‑by‑step instructions for deploying the **PanoTour** template infrastructure on Wikimedia Commons and the **wikipano** Toolforge tool. It is intended to be a **copy‑paste ready** reference — you can open each URL, paste the exact wikitext, and save.

---

## 1. Prerequisite – Log in to Commons

1. Open a browser and go to:  
   <https://commons.wikimedia.org/wiki/Special:UserLogin>

2. Enter your **Commons username** and **password**.

3. After you are logged in, keep the browser tab open — you will need it for the next steps.

---

## 2. Create the PanoTour Templates on Commons

### Template: `PanoTour/link`

**URL to edit**  
```
https://commons.wikimedia.org/w/index.php?title=Template:PanoTour/link&action=edit
```

**Paste the following text:**

```
https://wikipano.toolforge.org/tour_viewer.html#{{{1}}}
```

*Save the page.*  

---

### Template: `PanoTour/layout`

**URL to edit**  
```
https://commons.wikimedia.org/w/index.php?title=Template:PanoTour/layout&action=edit
```

**Paste the following text:**

```wiki
{|cellpadding="3" class="toccolours vcard commons-file-information-table" dir="{{#dir:{{{lang|}}}}}" lang="{{{lang|}}}" style="width:100%"
|-
!id="panotourtemplate" class="fileinfo-paramfield" width="15%" |{{{tour|Tour}}}<span class="fn org" style="display:none">{{{name|{{PAGENAME}}}}}</span>
|{{lang|{{{lang|}}}|2={{{text|}}}}}
|}<noinclude>[[Category:Layout templates|{{PAGENAME}}]]</noinclude>
```

*Save the page.*  

---

### Template: `PanoTour/en`

**URL to edit**  
```
https://commons.wikimedia.org/w/index.php?title=Template:PanoTour/en&action=edit
```

**Paste the following text:**

```wiki
{{PanoTour/layout
|text=View as {{plainlink|1=https://wikipano.toolforge.org/tour_viewer.html#{{SUBPAGENAMEE}}|2=360° interactive tour}} (multiple scenes with navigation)
|lang=en
}}<noinclude>{{Translated tag|navigational}}</noinclude>
```

*Save the page.*  

---

### Template: `PanoTour` (main template)

**URL to edit**  
```
https://commons.wikimedia.org/w/index.php?title=Template:PanoTour&action=edit
```

**Paste the following text:**

```wiki
{{#invoke:Autotranslate|autotranslate|base=PanoTour}}<noinclude>{{documentation}}</noinclude>
```

*Save the page.*  

---

### Template: `PanoTour/doc`

**URL to edit**  
```
https://commons.wikimedia.org/w/index.php?title=Template:PanoTour/doc&action=edit
```

**Paste the following text:**

```wiki
{{Documentation subpage}}

== Usage ==
Place this template on a tour definition page to create a link to view it as an interactive 360° tour.

=== Example ===
On <code>User:Example/My_Tour</code> containing tour JSON, add:
<pre>{{PanoTour}}</pre>

This creates a link to:
https://wikipano.toolforge.org/tour_viewer.html#User:Example/My_Tour

== See also ==
* {{tl|Pano360}} – for single panorama images
* [[Commons:360° panoramas]]

<noinclude>[[Category:Template documentation|{{PAGENAME}}]]</noinclude>
```

*Save the page.*  

---

## 3. Quick Test

1. Go to **User:Fuzheado/Panellum_Tour** (or any other wiki page that contains a tour definition).  
2. Add the line `{{PanoTour}}` anywhere on that page.  
3. Save the page.  
4. The link will now open the tour in the **Pannellum** viewer at  
   `https://wikipano.toolforge.org/tour_viewer.html#User:Fuzheado/Panellum_Tour`.  

---

## 4. Verify the Templates

1. Visit the **Tour Viewer** at:  
   <https://wikipano.toolforge.org/tour_viewer.html#User:Fuzheado/Panellum_Tour>

2. Verify that the **🧭 Gyro** button appears in the footer **only on mobile devices** (it will be hidden on desktop).

3. If you see the button, the gyroscope functionality is active and the deployment is complete.

---

## 5. Deploy to Toolforge (if not already done)

### Create the tool

```bash
ssh login.toolforge.org
become wikipano
webservice --backend=kubernetes node start
```

### Deploy the prototype

```bash
rsync -avz --exclude='node_modules' --exclude='cache' --exclude='images' \
     prototype/ alih@login.toolforge.org:/data/project/wikipano/www/
```

The `tour_server.mjs` file is already the entry point, so no code changes are required.

The `{{PanoTour}}` template you just created will automatically link to the new tool.

---

## 6. Quick Reference Table

| Template | Purpose | URL to edit |
|----------|---------|--------------|
| `PanoTour/link` | Generates the URL for a tour | `https://commons.wikimedia.org/w/index.php?title=Template:PanoTour/link&action=edit` |
| `PanoTour/layout` | Controls how the tour is displayed | `https://commons.wikimedia.org/w/index.php?title=Template:PanoTour/layout&action=edit` |
| `PanoTour/en` | English‑language version of the layout | `https://commons.wikimedia.org/w/index.php?title=Template:PanoTour/en&action=edit` |
| `PanoTour` | Main template (autotranslate) | `https://commons.wikimedia.org/w/index.php?title=Template:PanoTour&action=edit` |
| `PanoTour/doc` | Documentation page | `https://commons.wikimedia.org/w/index.php?title=Template:PanoTour/doc&action=edit` |

---

## 7. Notes

- The templates follow the same pattern as the existing `{{Pano360}}` template on Commons.
- The tour viewer is served over **HTTPS** (required for the DeviceOrientation / gyroscope API).
- The gyroscope toggle button (🧭) appears automatically on mobile devices; it is hidden on desktop.
- All tour definitions are stored as wiki pages (JSON or TOML) on Commons — no database required.
- The `wikipano.toolforge.org` tool runs the zero‑dependency Node.js server (`tour_server.mjs`).

---

*You now have a complete, copy‑paste ready deployment document. Open each URL, paste the corresponding block, save, and you’re done.*