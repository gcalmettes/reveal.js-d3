# Reveal.js-d3

[Reveal.js](https://github.com/hakimel/reveal.js/) plugin to integrate [D3](https://d3js.org) visualizations into HTML slides and trigger transitions/animations fully compatible with the Reveal.js `data-fragment-index` fragements attribute. [Check out the live demo](https://gcalmettes.github.io/reveal.js-d3/demo/)

The development of this plugin has been inspired by [Reveal.js plugin - d3js](https://github.com/jlegewie/reveal.js-d3js-plugin), but has some major differences:
- the D3 visualizations are loaded only when the slide is active and dumped when the slide is changed so the browser is not overloaded with running multiples iframes.
- this plugin support multiple visualizations on the same slide
- the triggering of the transitions for the visualizations is fully compatible with Reveal.js [`data-fragment-index`](https://github.com/hakimel/reveal.js/#fragments) feature. 

## Principal features:

## Usage:

