# cvnewtheme

`cvnewtheme` is a reusable Hugo resume theme. Its SCSS pipeline requires Hugo Extended.

## Use the theme in a Hugo site

1. Add the public theme repository as a submodule from the root of the Hugo site.

   ```bash
   git submodule add --branch dev ../cvnewtheme themes/cvnewtheme
   ```

2. Set the theme in the site's `config.toml`.

   ```toml
   theme = "cvnewtheme"
   ```

3. Copy the guiding placeholders from `exampleSite/config.toml`, then replace every `YOUR_...` value and every `.invalid` URL.

4. Preview the site.

   ```bash
   hugo server
   ```

5. Build the site.

   ```bash
   hugo --gc --minify
   ```

## Test the example site

Run this command from the theme repository root:

```bash
hugo --source exampleSite --themesDir ../.. --theme cvnewtheme
```

The original design attribution and license are preserved in `LICENSE.md` and `theme.toml`.
