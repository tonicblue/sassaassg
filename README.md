# **SassaaSSG** _(Sass as a Static Site Generator)_

Requires [Bun](https://bun.sh). To install dependencies:

```bash
bun install
```

To run:

```bash
bun run src/index.ts
```

All that happens when you run it is it runs all files matching `./scss-tests/*.scss` through the parser and saves the parsed AST from gonzales-pe along with the HTML. This is all still a major work in progress.