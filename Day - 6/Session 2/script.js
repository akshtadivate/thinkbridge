// Keyword data
const keywords = {
  html: [
    { name: "<div>", description: "Defines a division or section in HTML." },
    { name: "<span>", description: "Used to group inline elements." },
    { name: "<a>", description: "Defines a hyperlink." },
    { name: "<img>", description: "Displays an image." },
    { name: "<ul>", description: "Unordered list." },
    { name: "<ol>", description: "Ordered list." },
    { name: "<li>", description: "List item." },
    { name: "<p>", description: "Paragraph element." },
    {
      name: "<h1>-<h6>",
      description: "Heading elements from largest to smallest.",
    },
    { name: "<table>", description: "Defines a table." },
    { name: "<tr>", description: "Table row." },
    { name: "<td>", description: "Table cell." },
    { name: "<th>", description: "Table header cell." },
    { name: "<form>", description: "Defines an HTML form." },
    { name: "<input>", description: "Defines an input field." },
    { name: "<button>", description: "Clickable button." },
    { name: "<label>", description: "Label for form elements." },
    { name: "<textarea>", description: "Multi-line text input." },
    { name: "<select>", description: "Dropdown list control." },
    { name: "<option>", description: "Defines an option inside select." },
    {
      name: "<header>",
      description: "Introductory content, usually at the top.",
    },
    {
      name: "<footer>",
      description: "Footer section at the bottom of a page.",
    },
    { name: "<nav>", description: "Navigation links section." },
    { name: "<section>", description: "Logical section of a document." },
    {
      name: "<article>",
      description: "Independent content block (like blog post).",
    },
    {
      name: "<aside>",
      description: "Content related to the main content (sidebar).",
    },
    {
      name: "<main>",
      description: "Represents the main content of a document.",
    },
    { name: "<iframe>", description: "Embeds another HTML page." },
    { name: "<video>", description: "Embeds a video file." },
    { name: "<audio>", description: "Embeds an audio file." },
    { name: "<link>", description: "Defines external resources like CSS." },
    { name: "<meta>", description: "Metadata about the document." },
    { name: "<title>", description: "Defines the page title in browser tab." },
    { name: "<script>", description: "Embeds JavaScript." },
    { name: "<style>", description: "Embeds CSS styles." },
    { name: "<br>", description: "Line break." },
    { name: "<hr>", description: "Horizontal rule (divider)." },
  ],
  css: [
    { name: "color", description: "Sets the text color." },
    { name: "background-color", description: "Sets the background color." },
    { name: "margin", description: "Sets space outside elements." },
    { name: "padding", description: "Sets space inside elements." },
    { name: "border", description: "Sets border style, width, and color." },
    { name: "width", description: "Sets element width." },
    { name: "height", description: "Sets element height." },
    { name: "display", description: "Controls layout display." },
    { name: "position", description: "Controls positioning of element." },
    { name: "flex", description: "Enables flexible layout." },
    { name: "justify-content", description: "Aligns flex items horizontally." },
    { name: "align-items", description: "Aligns flex items vertically." },
    { name: "grid", description: "Enables grid layout." },
    { name: "font-size", description: "Sets font size." },
  ],
  javascript: [
    { name: "let", description: "Declares a block-scoped variable." },
    { name: "const", description: "Declares a constant variable." },
    { name: "var", description: "Declares a function-scoped variable." },
    { name: "if", description: "Conditional statement." },
    { name: "else", description: "Conditional alternative." },
    { name: "switch", description: "Multiple conditional cases." },
    { name: "for", description: "Loop with counter." },
    { name: "while", description: "Loop while condition is true." },
    { name: "do...while", description: "Loop that executes at least once." },
    { name: "function()", description: "Defines a function." },
    { name: "return", description: "Returns value from function." },
    {
      name: "document.getElementById()",
      description: "Selects element by ID.",
    },
    {
      name: "document.querySelector()",
      description: "Selects element by CSS selector.",
    },
    {
      name: "addEventListener()",
      description: "Attaches an event handler to element.",
    },
    { name: "console.log()", description: "Prints output to console." },
    {
      name: "Array.map",
      description: "Creates new array by applying function.",
    },
    {
      name: "Array.filter",
      description: "Creates new array with filtered values.",
    },
    { name: "Array.forEach", description: "Iterates over array items." },
  ],
};

// Render keywords
function displayKeywords() {
  for (const category in keywords) {
    const list = document.getElementById(`${category}-list`);
    list.innerHTML = "";

    keywords[category].forEach((k) => {
      const li = document.createElement("li");
      const name = document.createElement("strong");
      name.textContent = k.name;

      const desc = document.createElement("span");
      desc.textContent = " - " + k.description;
      desc.style.display = "none";

      li.appendChild(name);
      li.appendChild(desc);

      li.addEventListener("click", () => {
        desc.style.display = desc.style.display === "block" ? "none" : "block";
      });

      list.appendChild(li);
    });
  }
}

// Search only by name
document.getElementById("search").addEventListener("input", (e) => {
  const term = e.target.value.toLowerCase();

  let firstMatch = null;

  for (const category in keywords) {
    const list = document.getElementById(`${category}-list`);
    const items = Array.from(list.children);

    items.forEach((li) => {
      const nameText = li.querySelector("strong").textContent.toLowerCase();

      if (nameText.includes(term) && term !== "") {
        li.style.background = "#fff4a3"; // highlight
        if (!firstMatch) firstMatch = li;
      } else {
        li.style.background = "transparent"; // reset
      }
    });
  }

  // Only scroll if there is a match
  if (firstMatch) {
    firstMatch.scrollIntoView({ behavior: "smooth", block: "center" });
  }
});

// Initial render
displayKeywords();
