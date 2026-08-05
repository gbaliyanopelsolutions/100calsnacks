(function ($) {
  $(function () {
    var $strip = $('[data-auto-toc]');
    var $body = $('.art-body');

    if (!$strip.length || !$body.length) return;

    var $h2s = $body.find('h2');

    if (!$h2s.length) {
      $strip.hide();
      return;
    }

    $strip.find('.art-toc-item').remove();

    $h2s.each(function () {
      var text = $(this).text().trim();
      var slug = text
        .toLowerCase()
        .replace(/\s+/g, '-')
        .replace(/[^a-z0-9-]/g, '')
        .replace(/-{2,}/g, '-')
        .replace(/^-+|-+$/g, '');

      $(this).attr('id', slug);
      $strip.find('.art-toc-strip-inner').append(
        '<a href="#' + slug + '" class="art-toc-item">' + text + '</a>'
      );
    });

    $strip.show();
  });
})(jQuery);
