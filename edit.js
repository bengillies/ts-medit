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

	var tagHelper = (function() {
		var allTags = [],
			$popup = $('.popup'),
			$tags = $('.tags'),
			$sandbox = $('#sandbox .tags'),
			on = false,
			nth = 1,
			selecting = false,
			tagStart, tagEnd, currTag, cursorPos;

		store.refresh(function(tiddlers) {
			allTags = fp.uniq(fp.flatten(tiddlers.map(function(t) {
				return t.tags;
			})));
		});

		function currentTag(tagString, cursor) {
			var r = /^(?:\s*\[\[([^\]\]]+)|\s*([^\s]+))/g,
				match, tag, length, pos = 0,
				rest = tagString;

			match = r.exec(rest);
			while (match) {
				tag = match[1] || match[2];
				rest = rest.slice(r.lastIndex);
				length = tag.length;
				pos += r.lastIndex;
				if (pos >= cursor && pos - length <= cursor) {
					currTag = tag;
					tagStart = pos - length;
					tagEnd = pos;
					if (!~['[', '[[', ']', ']]'].indexOf(tag)) {
						return [tag, pos - length, pos];
					} else {
						break;
					}
				}

				r = /^(?:\s*\[\[([^\]\]]+)|\s*([^\s]+))/g;
				match = r.exec(rest);
			}

			return [null, null, null];
		}

		function matchTags(tagString) {
			var matches = allTags.filter(function(tag) {
				return !!~tag.indexOf(tagString);
			});
			matches = matches.slice(0, 8);
			if (tagString) {
				matches.push(tagString);
			}
			return matches;
		}

		function getLeftPos(tagString) {
			$sandbox.text(tagString);
			return $sandbox.outerWidth() + $tags.offset().left + 5;
		}

		function positionPopup(tagString, tagStart) {
			$popup.css('top', $tags.position().top - $popup.outerHeight() + 1)
				.css('left', getLeftPos(tagString.slice(0, tagStart)));
		}

		function stop() {
			$popup.removeClass('show');
			on = false;
		}

		function insertTag(tag) {
			var tagString = $tags.val();

			currTag = tag;

			if (/\s/.test(tag) && tagString.charAt(tagStart - 1) !== '[') {
				tag = '[[' + tag + ']]';
			}

			$tags.val(tagString.slice(0, tagStart) + tag +
				tagString.slice(tagEnd));

			tagEnd = tagStart + tag.length;

			fp.nextTick(function() {
				$tags[0].setSelectionRange(tagEnd, tagEnd);
			});
		}

		function click(ev) {
			var tag = $(ev.target).text();
			insertTag(tag);
			stop();
		}

		function arrows(ev) {
			var newSelection;
			if (ev.keyCode == 40) { // down
				ev.preventDefault();
				if (nth < $popup.find('li').length) {
					nth++;
					newSelection = $popup.find('li.active')
						.removeClass('active')
						.next('li').addClass('active');

					insertTag(newSelection.text());
				}
				selecting = true;
			} else if (ev.keyCode == 38) { // up
				ev.preventDefault();
				if (nth > 1) {
					nth--;
					newSelection = $popup.find('li.active')
						.removeClass('active')
						.prev('li').addClass('active');

					insertTag(newSelection.text());
				}
				selecting = true;
			} else if (ev.keyCode == 13) { // enter
				ev.preventDefault;
				insertTag($popup.find('li.active').text());
				stop();
			}
		}

		function fillCompleteList(ev) {
			var $el = $(ev.target),
				tagString = $el.val(),
				cursor = ev.target.selectionStart;

			if (ev.keyCode == 40 || ev.keyCode == 38) {
				ev.preventDefault();
			}

			if (selecting) {
				selecting = false;
				return;
			}

			cursorPos = cursor;

			var tagMatch = currentTag(tagString, cursor),
				tag = tagMatch[0],
				matchingTags = matchTags(tag);

			if (!on && matchingTags.length) {
				fp.nextTick(function() {
					$popup.addClass('show');
					positionPopup(tagString, tagMatch[1]);
				});
				nth = matchingTags.length;
			} else if (matchingTags.length == 0) {
				$popup.removeClass('show');
				on = false;
			}

			$popup.html(matchingTags.map(function(tag) {
				return '<li><a>' + tag + '</a></li>';
			})).find('li:nth-child(' + nth + ')').addClass('active');
		}

		return function() {
			$tags.on('keydown', arrows)
				.on('keyup change', fillCompleteList)
				.on('blur', stop);
			$popup.on('click', 'li', click);
		};
	}());

	$(function() {
		var $title = $('.title');

		var title = decodeURIComponent(document.location.hash.slice(1));

		if (title) {
			loadTiddler(title, fp.partial(populateInput, title));
		} else {
			populateInput('');
		}

		tagHelper();
	}());
}());
