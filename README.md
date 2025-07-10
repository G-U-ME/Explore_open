# Explore

A dynamic, card-based knowledge exploration tool that reimagines note-taking as an interactive, hierarchical conversation with AI.

![placeholder](https://via.placeholder.com/800x400.png?text=Explore+Project+UI+Screenshot)
*(A screenshot or GIF of the application in action would be ideal here.)*

## About The Project

Explore Project is a visual and interactive platform designed for dynamic knowledge exploration. It moves beyond traditional linear notes by representing ideas and conversations as a navigable, three-dimensional stack of cards. Each card is a self-contained chat session, which can branch off from any point in a previous conversation, creating a rich, hierarchical tree of thought.

This application is built for researchers, writers, developers, and anyone who thrives on non-linear thinking and wants to leverage AI to expand upon their ideas in a structured yet flexible way.

## Key Features

-   **Visual Card Stack Interface**: The current line of thought is represented as a stack of cards, providing a clear visual path of your exploration journey.
-   **Hierarchical Note-Taking**: Create new cards from existing ones, building a tree of interconnected ideas. A new card can be spawned from any selected text, allowing you to dive deeper into specific concepts.
-   **AI-Powered Conversations**: Each card is an interactive chat with a configurable AI model.
-   **Automatic Title Generation**: The AI automatically summarizes the content of a card to generate a concise title, keeping your workspace organized.
-   **2D Tree Navigation**: Get a bird's-eye view of your entire knowledge tree and quickly jump to any card in your project.
-   **Project-Based Organization**: Group your explorations into distinct projects, each with its own independent card tree.
-   **Drag-and-Drop Project Management**: Easily reorder your projects to fit your workflow.
-   **Multimedia & Context Support**: Attach files (images, documents) and use selected text from a parent card as context for new queries.
-   **Configurable Backend**: Easily configure the API endpoint, key, and available LLM models to connect with your preferred AI service.
-   **Web Search Integration**: Empower the AI with real-time web search capabilities for up-to-date information.

## Tech Stack

-   **Frontend**: [React](https://reactjs.org/) & [TypeScript](https://www.typescriptlang.org/)
-   **State Management**: [Zustand](https://github.com/pmndrs/zustand)
-   **Styling**: [Tailwind CSS](https://tailwindcss.com/)
-   **Drag & Drop**: [dnd-kit](https://dndkit.com/)
-   **Icons**: [Lucide React](https://lucide.dev/)

## Core Concepts

### 1. The Card Stack (Center View)

The heart of the application. It displays the `currentCard` in full view, ready for interaction. Its parent cards are stacked behind it, receding into the background along a gentle curve. This provides immediate context for your current position in the knowledge tree.

-   **Interaction**: You can click on any visible parent card to make it the `currentCard`.
-   **Creation**: Create a blank child card or select text within the current card to create a new card with that text as its initial context.

### 2. The Tree Navigation (Right Panel)

This panel provides a complete 2D map of your project's card structure.

-   **Representation**: Each card is a circle, and lines connect parents to children.
-   **Navigation**: The view automatically centers on the `currentCard`. You can scroll through the entire tree and click any node to instantly switch to that card.
-   **Clarity**: The `currentCard` is highlighted, and hovering over any node reveals its title.

### 3. Conversational Exploration (Input Area)

The input area is where you interact with the AI on the `currentCard`.

-   **Rich Input**: Beyond simple text, you can attach files and images.
-   **Context-Aware**: When you create a card from selected text, that text is automatically included as context for your first message.
-   **Model Selection**: Choose the AI model you want to use for the conversation on the fly.

## Getting Started

To get a local copy up and running, follow these simple steps.

### Prerequisites

-   Node.js (v16 or later)
-   npm, yarn, or pnpm

### Installation

1.  **Clone the repo**
    ```sh
    git clone https://github.com/your-username/explore-project.git
    cd explore-project
    ```

2.  **Install NPM packages**
    ```sh
    npm install
    # or
    yarn install
    ```

3.  **Set up environment variables**
    The application connects to a backend AI service. You must configure the API endpoint and your key. Create a `.env.local` file in the root of the project and add your configuration.

    The application looks for an OpenAI-compatible API endpoint.

    `.env.local.example`
    ```
    # No environment variables are strictly required by the code provided,
    # as settings are managed in the UI. However, if you wanted to set
    # default values, you could do so here and load them in the store.
    ```

4.  **Run the development server**
    ```sh
    npm run dev
    # or
    yarn dev
    ```
    Open [http://localhost:5173](http://localhost:5173) (or your configured port) to view it in the browser.

## Configuration

For the AI features to work, you must configure your API settings within the application itself:

1.  Click the **Settings** (gear) icon in the bottom-left corner.
2.  In the modal that appears:
    -   **API URL**: Enter the full URL of your LLM provider's chat completions endpoint (e.g., `https://api.openai.com/v1/chat/completions`).
    -   **API Key**: Enter your secret API key.
    -   **Model Names**: Add the specific model names you want to use (e.g., `gpt-4-turbo`, `claude-3-opus-20240229`). You can add multiple models to choose from in the input area.
3.  Click the **Save** (check) button. The settings are persisted locally in your browser.

## Project Structure

The codebase is organized with a focus on feature components and centralized state management.

```
/src
|-- /components
|   |-- CardStack.tsx       # Renders the main card stack view (Current & Parent cards)
|   |-- InputArea.tsx       # The user input field with file handling and model selection
|   |-- ProjectPanel.tsx    # The left panel for managing projects
|   |-- SettingsModal.tsx   # Modal for configuring API and models
|   |-- TreeNavigation.tsx  # The right panel for 2D tree visualization
|
|-- /stores
|   |-- cardStore.ts        # Zustand store for managing all card data and interactions
|   |-- projectStore.ts     # Zustand store for managing projects and the active project
|   |-- settingsStore.ts    # Zustand store for API settings and modals
|
|-- App.tsx                 # Main application component, lays out the three panels
|-- main.tsx                # Application entry point
```

## Contributing

Contributions are what make the open-source community such an amazing place to learn, inspire, and create. Any contributions you make are **greatly appreciated**.

If you have a suggestion that would make this better, please fork the repo and create a pull request. You can also simply open an issue with the tag "enhancement".

1.  Fork the Project
2.  Create your Feature Branch (`git checkout -b feature/AmazingFeature`)
3.  Commit your Changes (`git commit -m 'Add some AmazingFeature'`)
4.  Push to the Branch (`git push origin feature/AmazingFeature`)
5.  Open a Pull Request

## License

Distributed under the MIT License. See `LICENSE` for more information.