
# Gadgets and Those - Official Discovery Hub

This is the official product discovery platform for the **@GadgetsAndThose** TikTok community. It features a dual-mode AI Discovery Scout that helps users find the perfect tech gear via text or real-time voice.

## 🚀 Deployment Instructions

### 1. GitHub Setup
- Push this code to a new repository on GitHub.

### 2. Netlify Deployment
- Connect your GitHub repo to Netlify.
- **Environment Variables**: Go to Site Settings > Environment Variables and add:
  - `API_KEY`: Your Google Gemini API Key.
- **Identity**: 
  - Go to Site Settings > Identity and click "Enable Identity".
  - Scroll down to "Services" and click "Enable Git Gateway". This allows the Admin panel to save changes directly to your GitHub.

### 3. Managing Products
- Visit `https://your-site.com/admin` to log in.
- You can add, edit, or delete gadgets. When you save, Netlify will automatically rebuild your site with the new products.

## 🤖 AI Scout Features
- **Agentic Scouting**: The AI doesn't just sell; it analyzes user setups and provides reasoning.
- **Proactive Engagement**: Greets users with a "Deal of the Day" as soon as they open the chat.
- **Dual-Mode**: Seamlessly switch between typing and a natural voice conversation.

## 🛠 Tech Stack
- **Frontend**: React + Tailwind CSS
- **AI**: Google Gemini (Flash 2.5/3)
- **CMS**: Decap CMS (managed via Netlify)
- **Hosting**: Netlify
