(function() {
	var store = tiddlyweb.Store();

	function loadTiddler(title, fn) {
		store.get(title, fn);
	}

	function populateInput(title, tiddler) {
		if (!tiddler) {
			tiddler = new tiddlyweb.Tiddler(title);
		}

		$('.editor')
			.find('.text').val(tiddler.text).end()
			.find('.tags').val(tagsToString(tiddler.tags)).end()
			.find('.title').val(tiddler.title).focus().end();

		hookupControls(tiddler);
	}

	function tagsToString(tags) {
		if (tags == null) { tags = []; }

		var tagString = '';
		tags.forEach(function(tag) {
			if (/( |\t|\n|\r|\[|\])/.test(tag)) {
				tagString += '[[' + tag + ']] ';
			} else {
				tagString += tag + ' ';
			}
		});

		return tagString.slice(0, tagString.length - 1);
	}

	function stringToTags(tagString) {
		var brackets = /^\s*\[\[([^\]\]]+)\]\](\s*.*)/,
			whitespace = /^\s*([^\s]+)(\s*.*)/,
			match,
			rest = tagString,
			tags = [];

		match = brackets.exec(rest) || whitespace.exec(rest);
		while (match) {
			tags.push(match[1]);
			rest = match[2];
			match = brackets.exec(rest) || whitespace.exec(rest);
		}

		return tags;
	}

	function close() {
		window.history.go(-1);
	}

	function hookupControls(tiddler) {
		var deleteLater, deleteBagLater;

		function changeType(ev) {
			var $el = $(ev.target),
				type = $el.data('type');

			if (type) {
				tiddler.type = type;
			} else {
				tiddler.type = null;
			}

			cache();
			$el.closest('.type').find('li').removeClass('active');
			$el.closest('li').addClass('active');
		}

		function save(ev) {
			var $el = $(ev.target);

			$el.addClass('disabled').text('saving...');

			store.save(tiddler.title, function(tid) {
				if (!tid) {
					alert('Could not save tiddler');
				} else {
					if (deleteBagLater) {
						var t =
							new tiddlyweb.Tiddler(deleteLater || tiddler.title);
						t.bag = deleteBagLater;
						store.destroy(t, function() {});
						deleteBagLater = undefined;
					}

					if (deleteLater) {
						store.destroy(deleteLater, function() {});
						deleteLater = undefined;
					}

					$el.removeClass('disabled').text('save');
					setTimeout(close, 500);
				}
			});
		}

		function cancel(ev) {
			if (tiddler.lastSync ||
					(!tiddler.title && !tiddler.text && !tiddler.tags.length)) {
				store.remove(tiddler.title);
				unhookControls();
				close();
			} else if (confirm('Really cancel? '
					+ 'You will lose all unsaved changes.')) {
				store.remove(tiddler.title);
				unhookControls();
				close();
			}
		}

		function remove(ev) {
			if (confirm('Are you sure?')) {
				if (deleteBagLater) {
					var t = new tiddlyweb.Tiddler(deleteLater || tiddler.title);
					t.bag = deleteBagLater;
					store.destroy(t, function() {});
					deleteBagLater = undefined;
				}

				store.destroy(tiddler, function(tid) {
					if (!tid && !deleteLater) {
						alert('There was a problem deleting this tiddler');
					} else if (deleteLater) {
						store.destroy(deleteLater, function(t) {
							if (!t) {
								alert('There was a problem deleting this tiddler');
							} else {
								unhookControls();
								populateInput('');
								deleteLater = '';
								close();
							}
						});
					} else {
						if (deleteLater) {
							store.destroy(deleteLater, function() {});
							deleteLater = '';
						}
						unhookControls();
						populateInput('');
						close();
					}
				});
			}
		}

		function changePrivacy(ev) {
			var $el = $(ev.target),
				isPrivate = $el.prop('checked'),
				defaultBag = store.getDefaults().pushTo,
				newBag;

			if (isPrivate) {
				newBag = defaultBag.name.replace(/_public$/, '_private');
			} else {
				newBag = defaultBag.name.replace(/_private$/, '_public');
			}

			if (newBag !== (tiddler.bag && tiddler.bag.name)) {
				deleteBagLater = tiddler.bag;
				store.remove(tiddler);
				tiddler.bag = new tiddlyweb.Bag(newBag, '/');
				store.add(tiddler);
			}
		}

		function cache(ev) {
			fp.nextTick(function() {
				var oldTitle = tiddler.title;

				tiddler.title = $('.editor .title').val();
				tiddler.text = $('.editor .text').val();
				tiddler.tags = stringToTags($('.editor .tags').val());

				if (tiddler.title) {
					store.add(tiddler);
				}
				if (oldTitle !== tiddler.title) {
					store.remove(oldTitle);

					if (tiddler.lastSync) {
						deleteLater = oldTitle;
					}
				}
			});
		}

		function unhookControls() {
			$('.type a').off('click', changeType);
			$('.save').off('click', save);
			$('.cancel').off('click', cancel);
			$('.delete').off('click', remove);
			$('.private').off('change', changePrivacy);
			$('.editor input, .editor textarea').off('change keyup', cache);
		}

		if (tiddler.type) {
			$('.type').find('.active').removeClass('active').end()
				.find('a[data-type="' + tiddler.type + '"]')
				.closest('li').addClass('active');
		} else if ($('.type li.active').length) {
			changeType({ target: $('.type li.active a') });
		}

		if (tiddler.bag && /_private$/.test(tiddler.bag.name)) {
			$('.private').prop('checked', true);
		} else if (tiddler.bag && /_public$/.test(tiddler.bag.name)) {
			$('.private').prop('checked', false);
		}

		$('.type a').on('click', changeType);
		$('.save').on('click', save);
		$('.cancel').on('click', cancel);
		$('.delete').on('click', remove);
		$('.private').on('change', changePrivacy);
		$('.editor input, .editor textarea').on('change keyup', cache);
	}

	$(function() {
		var $title = $('.title');

		var title = decodeURIComponent(document.location.hash.slice(1));

		if (title) {
			loadTiddler(title, fp.partial(populateInput, title));
		} else {
			populateInput('');
		}
	}());
}());
