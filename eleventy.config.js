export default function (eleventyConfig) {
  eleventyConfig.addPassthroughCopy({ 'node_modules/exceljs/dist/exceljs.min.js': 'scripts/vendor/exceljs.min.js' });
  eleventyConfig.addPassthroughCopy({ 'src/styles': 'styles' });
  eleventyConfig.addPassthroughCopy({ 'src/scripts': 'scripts' });
  eleventyConfig.addPassthroughCopy({ 'src/assets': 'assets' });
  eleventyConfig.addPassthroughCopy({ 'src/nicolabz-design-system': 'nicolabz' });
  eleventyConfig.ignores.add('scripts/**');
  eleventyConfig.ignores.add('docs/**');
  eleventyConfig.ignores.add('content/**');
  return {
    dir: { input: '.', output: 'dist', includes: '_includes', data: '_data' },
    templateFormats: ['html', 'njk'],
    htmlTemplateEngine: 'njk'
  };
}
