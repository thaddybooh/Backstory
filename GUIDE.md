# Backstory: your step-by-step guide

No coding needed for any of this. Everything happens in your web browser on GitHub and Vercel.

---

## 1. Put the new site on your main branch (GitHub, about 2 minutes)

The site was built on a separate branch called `claude/backstory-website-build-7x0ic8`. Vercel publishes the
`main` branch, so first move the work there.

1. Go to https://github.com/thaddybooh/Backstory and sign in.
2. You should see a yellow banner saying the branch had recent pushes, with a green **Compare & pull request**
   button. Click it.
   (No banner? Click the **Pull requests** tab, then **New pull request**, set "compare" to
   `claude/backstory-website-build-7x0ic8`, then **Create pull request**.)
3. Click **Create pull request**.
4. On the next page, click **Merge pull request**, then **Confirm merge**.

That's it: `main` now holds the site.

## 2. Publish it on Vercel for free (about 5 minutes)

1. Go to https://vercel.com and click **Sign Up**.
2. Choose the **Hobby** plan (free), enter your name, then pick **Continue with GitHub** and allow access.
3. On your Vercel dashboard, click **Add New…** then **Project**.
4. Find **Backstory** in the list of your GitHub repositories and click **Import**.
   If it isn't listed, click **Adjust GitHub App Permissions**, give Vercel access to the Backstory repository,
   and come back.
5. Vercel detects everything by itself (it should say **Astro** under Framework Preset). Don't change any settings.
6. Click **Deploy** and wait a minute or two.
7. When you see the congratulations screen, click the preview image to open your live site. Its address will look
   like `backstory-something.vercel.app`.

From now on, every change saved to `main` on GitHub is published automatically within a couple of minutes.

## 3. Check the photos (after the first deploy)

The photos are downloaded from Wikimedia Commons while Vercel builds the site, together with the photographer's
name and licence. They couldn't be downloaded during the build session, so nobody has seen them on the page yet.

1. Open your live site and read through both issues. Look at each photo and its caption.
2. Optional: to see which photos downloaded, go to your project in Vercel, click **Deployments**, click the latest
   one, open **Build Logs**, and look for lines starting with `images:`. Any line saying "not found" or "skipped"
   means that photo is missing.
3. Tell Claude in your next session which photos look wrong or are missing, and it will fix them.

## 4. Preview changes before they go live

Easiest way (no installing): whenever Claude pushes work to a branch other than `main`, Vercel makes a private
**preview** link for it. Find it in Vercel under **Deployments**, or on the pull request page on GitHub
(the Vercel bot comments with a "Visit Preview" link). Check it, then merge the pull request to publish.

Optional, on your own computer (only if you want to):
1. Install Node.js (the "LTS" version) from https://nodejs.org.
2. On the GitHub repository page, click the green **Code** button, then **Download ZIP**, and unzip it.
3. Open the Terminal (Mac) or Command Prompt (Windows), type `cd ` (with a space), drag the unzipped folder into
   the window, and press Enter.
4. Type `npm install` and press Enter. Wait until it finishes.
5. Type `npm run dev` and press Enter, then open http://localhost:4321 in your browser.
   Press Ctrl+C in the Terminal to stop it.

## 5. Add a custom domain later (optional)

1. Buy a domain from any registrar (e.g. Namecheap, Cloudflare, Porkbun).
2. In Vercel, open your project, then **Settings**, **Domains**, type your domain and click **Add**.
   Vercel shows the exact DNS records to copy into your registrar's settings.
3. Still in Vercel **Settings**, open **Environment Variables**, add one called `SITE_URL` with the value
   `https://yourdomain.com`, and click **Save**. Then redeploy (Deployments, the latest one, **⋯**, **Redeploy**)
   so link previews on LinkedIn use the new address.

## 6. Choosing topics

Open `topics/queue.md` on GitHub, click the pencil icon, and edit the list under **Up next**:

```
- world: The topic -- any angle or question you want answered
- singapore: Another topic
```

Order matters: the next World issue takes the first `world:` line, the next Singapore issue the first
`singapore:` line. If there's nothing for that day's track, Claude picks the biggest story itself. Click
**Commit changes** to save.

## 7. Approving a new issue

1. Ask Claude "write today's issue" (later this happens automatically each morning).
2. Claude opens a **pull request** on GitHub, titled like "Issue 003 (World): ...". Its description lists the
   word count, number of sources and anything you should double-check.
3. A Vercel bot comments on the pull request with a **Visit Preview** link. Read the issue there.
4. Happy with it? Click **Merge pull request**, then **Confirm merge**. It's live within a couple of minutes.
   Not happy? Comment on the pull request or tell Claude what to change, then check the preview again.

## 8. The question graph

Every issue now opens with a "Start with a question" graph, and today's graph also appears on the homepage. Claude
writes it as part of each new issue (a file ending in `.graph.json` next to the issue, in the same pull request),
so there is nothing extra for you to do. When you review a pull request, open the preview, click a few questions
and check that the answers read well and the "Read this in today's issue" links land in the right place.

## 9. Changing the look

All colours and fonts are in one file: `src/styles/tokens.css`. If you want to try one of the other design
directions ("Briefing room" or "Cover story"), ask Claude. Most of the change happens in that file.

## 10. Update your old "backstory-issue" skill (one time)

Your claude.ai account has an older skill called **backstory-issue** that makes each issue as a standalone HTML
page. The website now has its own instructions inside the repo, so the old skill should point there instead.
In claude.ai, open **Settings**, then **Capabilities** (or **Skills**), find **backstory-issue**, and either
turn it off or replace its text with:

```
---
name: backstory-issue
description: Use when Miles asks for a Backstory issue.
---
Backstory issues are now written in the thaddybooh/Backstory GitHub repository. Work in that repository
and follow its write-issue skill (.claude/skills/write-issue/SKILL.md). Do not publish issues as HTML
artifacts.
```
