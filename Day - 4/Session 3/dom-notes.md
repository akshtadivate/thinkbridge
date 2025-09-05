# DOM Events Practice

This project demonstrates **JavaScript DOM manipulation** using event listeners, dynamic updates, and class toggling.

---

## Features Implemented

### Element Selection
- `getElementById()` - select single elements (`title`, `message`, `buttons`, `input`, etc.).
- `querySelectorAll()` - select all `<li>` items in the list.

### Event Listeners
1. **Click Events**
    `Change Text` - updates paragraph text & adds a `highlight` class.
    `Toggle Color` - toggles a `colored` class on the title.
    `Add Item` - creates new list items dynamically, each clickable with an alert.
    `Dark Mode` - toggles dark mode on the entire page.

2. **Hover / Mouse Events**
    `mouseover` / `mouseout` on title - adds/removes `hovered` style.
    `contextmenu` (right-click) on message - shows a custom alert.

3. **Keyboard Events**
    `input` - updates live text preview while typing.
    `keydown` - detects when a key is pressed.
    `keyup` - detects when a key is released.
    `Enter` key on input → triggers an alert with entered value.

4. **Form Events**
    `submit` - prevents default page reload and shows alert with form input value.

5. **Window Events**
    `resize` - updates status bar with current window width & height.

---


