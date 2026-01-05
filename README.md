This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deployment

This project is deployed on **Vercel** using a direct GitHub integration.

### How it Works
1.  **Direct Integration**: Vercel is linked to the GitHub repository [markymo/compass](https://github.com/markymo/compass.git).
2.  **Auto-Deploy**: Any push to the `main` branch automatically triggers a new deployment.
3.  **Build Command**: The deployment process runs `npm run build`, which includes:
    - `prisma generate` (Sets up the database client)
    - `next build` (Builds the Next.js application)

### Workflow
* To deploy changes:
  ```bash
  git add .
  git commit -m "your message"
  git push origin main
  ```
* Track build progress in the [Vercel Dashboard](https://vercel.com/marks-projects-3dd0d5e3/compass/deployments).
