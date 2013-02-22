/*
 * does markdown support @space-name?
 */

var parser = (function() {
	var parsers = {
		tiddlywiki: '(?:@([^\\s]+)|\\[\\[([^\\]\\]]+)|<<tiddler ([^\\[\\[\\s' +
			'>>]+))',
		markdown: '(?:@([^\\s]+)|\\[\\[([^\\]\\]]+)|\\{\\{([^\\}\\}]+))'
	};

	var type = 'tiddlywiki',
		spaces = [],
		links = [],
		$el;

	var on = false,
		nth = 1,
		lineHeight,
		selecting = false,
		$popup = $('.popup'),
		insertText;

	function parse(text, cursor, parser) {
		var r, match, space, link, transclusion, start, end, length, found
			pos = 0,
			rest = text;

		while (match = (r = new RegExp(parser, 'g')).exec(rest)) {
			space = match[1], link = match[2], transclusion = match[3];
			rest = rest.slice(r.lastIndex);

			if (link) {
				link = ~link.indexOf('|') ? link.replace(/[^\|]*\|/,'') : link;
			}

			end = pos + r.lastIndex;
			found = space != null ? space : link != null ? link : transclusion
			length = found.length;
			start = end - length;
			pos += r.lastIndex;

			if (cursor >= start && cursor <= end) {
				return {
					start: start,
					end: end,
					length: length,
					space: space,
					link: link,
					transclusion: transclusion,
					match: found
				};
			}
		}
	}

	function getMatches(match) {
		var list = match.space ? spaces : links,
			current = match.match.toLowerCase();

		return list.filter(function(potentialMatch) {
			var lower = potentialMatch.toLowerCase();
			return ~lower.indexOf(current.toLowerCase());
		});
	}

	function gatherSpaces(tiddlers) {
		spaces = fp.uniq(tiddlers.find('#follow').map(function(t) {
			return t.title.replace(/^@/, '');
		}));
	}

	function gatherLinks(tiddlers) {
		links = fp.uniq(tiddlers.map(function(t) {
			return t.title;
		}));
	}

	function getMatch(ev) {
		var text = $el.val(),
			cursor = $el[0].selectionStart,
			current = parse(text, cursor, parsers[type]),
			matches;

		if ((ev.keyCode == 40 || ev.keyCode == 38) && on) {
			ev.preventDefault();
		}

		if (selecting) {
			selecting = false;
			return;
		}

		if (current) {
			matches = getMatches(current);
			if (!on && matches.length) {
				fp.nextTick(function() {
					insertText = fp.partial(_insertText, current);
					matches = matches.slice(0, 12);
					matches.unshift(current.match);

					$popup.html(matches.map(function(txt) {
						return '<li><a>' + txt + '</a></li>';
					})).find('li:nth-child(' + nth + ')').addClass('active');

					$popup.addClass('show');
					positionPopup(current, cursor);
				});
				nth = 1;
			} else if (matches.length == 0) {
				stop();
			}
		} else {
			stop();
		}
	}

	function doubleBrackets(ev) {
		function insertBrackets(next, cursor, insertCharacter) {
			var oldText
			if (/\s|\[|\{|\(|\]|\}|\)|\.|^$/.test(next)) {
				oldText = $el.val();
				$el.val(oldText.slice(0, cursor) + insertCharacter +
					oldText.slice(cursor));
				ev.target.setSelectionRange(cursor, cursor);
			}
		}

		var cursor = ev.target.selectionStart,
			txt = $el.val(),
			current = txt.charAt(cursor);
		switch (ev.keyCode) {
		case 91: // [
			insertBrackets(current, cursor, ']');
			break;
		case 123: // {
			insertBrackets(current, cursor, '}');
			break;
		case 40: // (
			insertBrackets(current, cursor, ')');
			break;
		case 93: // ]
			if (current == ']') {
				ev.target.setSelectionRange(++cursor, cursor);
				ev.preventDefault();
			}
			break;
		case 125: // }
			if (current == '}') {
				ev.target.setSelectionRange(++cursor, cursor);
				ev.preventDefault();
			}
			break;
		case 41: // )
			if (current == ')') {
				ev.target.setSelectionRange(++cursor, cursor);
				ev.preventDefault();
			}
		}
	}

	function _insertText(pos, text) {
		var val = $el.val();

		$el.val(val.slice(0, pos.start) + text + val.slice(pos.end));
		pos.end = pos.start + text.length;

		$el[0].setSelectionRange(pos.end, pos.end);
	}

	function stop() {
		$popup.removeClass('show');
		on = false;
	}

	function positionPopup(match, cursor) {
		var position;

		$el[0].setSelectionRange(match.start, match.start);

		position = $el.textareaHelper('caretPos');
		$popup.css('top', position.top + $el.offset().top + lineHeight)
			.css('left', position.left + $el.offset().left);

		$el[0].setSelectionRange(cursor, cursor);
	}

	function arrows(ev) {
		var newSelection;
		if ($popup.hasClass('show')) {
			if (ev.keyCode == 40) { // down
				ev.preventDefault();
				if (nth < $popup.find('li').length) {
					nth++;
					newSelection = $popup.find('li.active')
						.removeClass('active')
						.next('li').addClass('active');

					insertText(newSelection.text());
				}
				selecting = true;
			} else if (ev.keyCode == 38) { // up
				ev.preventDefault();
				if (nth > 1) {
					nth--;
					newSelection = $popup.find('li.active')
						.removeClass('active')
						.prev('li').addClass('active');

					insertText(newSelection.text());
				}
				selecting = true;
			} else if (ev.keyCode == 13) { // enter
				ev.preventDefault;
				insertText($popup.find('li.active').text());
				stop();
			}
		}

	}

	function click(ev) {
		var text = $(ev.target.text());
		insertText(text);
		stop();
	}

	function getLineHeight() {
		var text = $('#sandbox').append($('<textarea class="text"></textarea>')
			.val('\n')).find('.text')[0];
		text.setSelectionRange(1, 1);

		lineHeight = $(text).textareaHelper('caretPos').top;
		$(text).remove();
	}

	return {
		init: function(store, textarea) {
			store.refresh(function(tiddlers) {
				gatherSpaces(tiddlers);
				gatherLinks(tiddlers);
			});
			$el = textarea;

			$el.on('keydown', arrows)
				.on('keyup change', getMatch)
				.on('keypress', doubleBrackets)
				.on('blur', stop);

			$popup.on('click', 'li', click);
			getLineHeight();
		},
		setType: function(newType) {
			type = newType;
		}
	};
}());
