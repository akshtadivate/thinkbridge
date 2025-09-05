# Emmet Practice Examples

**Before (Emmet abbreviation):**
html:5

**After (Expanded):**
```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Document</title>
</head>
<body>

</body>
</html>
```

## Example 2: Unordered List
Before:

ul>li*5

After:
```html

<ul>
  <li></li>
  <li></li>
  <li></li>
  <li></li>
  <li></li>
</ul>

```

# Example 3: Nested Container with Text
Before:

div.container>h1{Welcome}+p{This is a paragraph.}

After:

```html
<div class="container">
  <h1>Welcome</h1>
  <p>This is a paragraph.</p>
</div>
```

# Example 4: Form with Inputs
Before:

form>input:text+input:email+input:submit

After:

```html
<form>
  <input type="text">
  <input type="email">
  <input type="submit">
</form>
```

# Example 5: Table with Rows and Cells
Before:

table>tr*3>td*2

After:

```html

<table>
  <tr>
    <td></td>
    <td></td>
  </tr>
  <tr>
    <td></td>
    <td></td>
  </tr>
  <tr>
    <td></td>
    <td></td>
  </tr>
</table>

```