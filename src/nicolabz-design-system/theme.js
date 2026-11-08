(() => {
  const storageKey = "nicolabz-theme";
  const root = document.documentElement;
  const systemTheme = window.matchMedia ? window.matchMedia("(prefers-color-scheme: dark)") : null;
  let savedTheme = null;
  let hasUserChoice = false;

  try {
    savedTheme = localStorage.getItem(storageKey);
    if (savedTheme !== null && savedTheme !== "light" && savedTheme !== "dark") {
      console.warn("Thème enregistré invalide :", savedTheme);
      savedTheme = null;
    }
  } catch (error) {
    console.warn("Impossible de lire le thème enregistré :", error);
  }
  hasUserChoice = savedTheme !== null;

  function applyTheme(theme) {
    root.dataset.theme = theme;
    window.dispatchEvent(new CustomEvent("nicolabz-theme-change", { detail: { theme } }));
  }

  function setTheme(theme) {
    if (theme !== "light" && theme !== "dark") {
      throw new TypeError("Le thème doit être « light » ou « dark ».");
    }
    hasUserChoice = true;
    applyTheme(theme);
    try {
      localStorage.setItem(storageKey, theme);
    } catch (error) {
      console.warn("Impossible d'enregistrer le thème :", error);
    }
  }

  window.nicolabzTheme = {
    getTheme: () => root.dataset.theme,
    setTheme,
    toggle: () => setTheme(root.dataset.theme === "dark" ? "light" : "dark")
  };

  applyTheme(savedTheme || (systemTheme && systemTheme.matches ? "dark" : "light"));
  if (systemTheme && systemTheme.addEventListener) {
    systemTheme.addEventListener("change", (event) => {
      if (!hasUserChoice) applyTheme(event.matches ? "dark" : "light");
    });
  }
})();
