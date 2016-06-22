var iframeDomain = 'http://localhost:9000/';
var animationDuration = 200;
var iframe;
var error;
var elementHighlighted;
// available fonts from prototypo
var fonts;
// variable to store current selected font sent from popup
var selectedFont = '';

// clear previously stored values on page load
chrome.storage.local.clear();

// setting up the iframe containing protypo app
var extensionOrigin = 'chrome-extension://' + chrome.runtime.id;
if(location.ancestorOrigins) {
	if (!location.ancestorOrigins.contains(extensionOrigin)) {
		setIframe();
	}
} else {
	setIframe();
}

//Here we send a message to the iframe to close the worker port
window.addEventListener('unload', function() {
	iframe.post({type: 'close'}, iframeDomain);
});
// on element selection start
window.addEventListener('selection_start', function(e) {
	console.log('selection_start');
	// here we store the font that was selected in the popup
	selectedFont = e.detail.message.font;
	sendStoreSelectedFontMessage(selectedFont);

	if (e.detail.message.selection) {
		Array.prototype.forEach.call(document.querySelectorAll('*:not([class*="prototypo-"])'), function(el) {
			el.addEventListener('mouseenter', highlightEl);
			el.addEventListener('mouseleave', highlightParent);
			el.addEventListener('click', chooseEl);
		});
	} else {
		Array.prototype.forEach.call(document.querySelectorAll('*:not([class*="prototypo-"])'), function(el) {
			el.removeEventListener('mouseenter', highlightEl);
			el.removeEventListener('mouseleave', highlightParent);
			el.removeEventListener('click', chooseEl);
		});
	}
});
// on echap, stop selection
window.addEventListener('keyup', function(e) {
	if(e.keyCode === 27) {
		unselectAllElements();
		Array.prototype.forEach.call(document.querySelectorAll('*:not([class*="prototypo-"])'), function(el) {
			el.removeEventListener('mouseenter', highlightEl);
			el.removeEventListener('mouseleave', highlightParent);
			el.removeEventListener('click', chooseEl);
		});
	}
});

// on click on popup 'apply' button
window.addEventListener('apply_style', function(e) {
	selectedFont = e.detail.message.selectedFont;

	// store relative data
	sendStoreSelectedFontMessage(selectedFont);

	// apply style to element
	applyStyleToEl(e.detail.message.selector, selectedFont);
});

// on keyup in popup selection input
window.addEventListener('select_elements', function(e) {
		var highlightedElements = document.querySelectorAll('.prototypo-selected');
		var elementsToHighlight = document.querySelectorAll(e.detail.message.selector);

		// un-highlight previously highlighted elements
		Array.prototype.forEach.call(highlightedElements, function(el) {
			el.classList.remove('prototypo-selected');
		});

		// highlight concerned elements
		Array.prototype.forEach.call(elementsToHighlight, function(el) {
			el.classList.add('prototypo-selected');
		});
});
window.addEventListener('unselect_all_elements',function(e) {
	var highlightedElements = document.querySelectorAll('.prototypo-highlight');
	var selectedElements = document.querySelectorAll('.prototypo-selected');
	var outlinedElements = document.querySelectorAll('.prototypo-outlined');

	// un-highlight previously highlighted elements
	Array.prototype.forEach.call(highlightedElements, function(el) {
		el.classList.remove('prototypo-selected');
	});
	// un-select previously selected elements
	Array.prototype.forEach.call(selectedElements, function(item) {
		item.classList.add('prototypo-highlight');
	});
	// un-outline previously outlined elements
	Array.prototype.forEach.call(outlinedElements, function(el) {
		el.classList.remove('prototypo-outlined');
	});
});

// listening to highlight
window.addEventListener('highlight_selection', function(e) {
	var items = document.querySelectorAll(e.detail.message.selector);
	Array.prototype.forEach.call(items, function(item) {
		item.classList.add('prototypo-highlight');
	});
});
// listening to unhighlight
window.addEventListener('unhighlight_selection', function(e) {
	var items = document.querySelectorAll(e.detail.message.selector);
	Array.prototype.forEach.call(items, function(item) {
		item.classList.remove('prototypo-highlight');
	});
});
// listening to style tag removal
window.addEventListener('remove_style_tag', function(e) {
	removeStyleTags(e.detail.message.selector);
});
// listening to Prototypo app worker messages
window.addEventListener('message', function(e) {
	if (!iframe) {
		iframe = e.source.parent.iframe;
	}

	if (error) {
		document.body.removeChild(error.el);
	}

	switch(e.data.type) {
		case 'font':
			document.fonts.add(new FontFace(e.data.font[1], e.data.font[0]));
			break;
		case 'library':
			// we store recieved data in a global variable
			// that will be queried by the popup on load
			fonts = e.data;
			break;
		case 'error':
			error = e.data.message;
			break;
	}
}, false);

/**
* Highlight a DOM element
* @param {object} e - the event that called the function
*/
function highlightEl(e) {
	if (elementHighlighted) {
		if (elementHighlighted.classList) {
			elementHighlighted.classList.remove('prototypo-outlined');
		}
	}

	if (e.target.classList) {
		e.target.classList.add('prototypo-outlined');
	}

	elementHighlighted = e.target;
}

/**
* Highlight a DOM element's parent
* @param {object} e - the event that called the function
*/
function highlightParent(e) {
	highlightEl({target: e.target.parentNode});
}

/**
* Choose a DOM element and store in chrome local data
* @param {object} e - the event that called the function
*/
function chooseEl(e) {
	if (e.target === e.currentTarget) {
		e.target.classList.remove('prototypo-outlined');
		if (e.preventDefault){
			e.preventDefault();
		}
		if (e.stopPropagation) {
			e.stopPropagation();
		}

		var selector = OptimalSelect.select(e.target, {
			ignore: {
				class: function(className) {
					return className === "";
				}
			}
		});

		sendStoreElementMessage(selector, selectedFont);

		Array.prototype.forEach.call(document.querySelectorAll('*:not([class*="prototypo-"])'), function(el) {
			el.removeEventListener('mouseenter', highlightEl);
			el.removeEventListener('mouseleave', highlightParent);
			el.removeEventListener('click', chooseEl);
		});

		// asking iframe worker
		if (iframe) {
			var textInSelected = '';
			// getting every piece of text containing characters to load
			Array.prototype.forEach.call(document.querySelectorAll(selector), function(el) {
				textInSelected += el.innerText;
			});
			// sending a message to the iframe worker
			// in order to retrieve every character of selected fonts
			// will make the iframe worker send a message back
			iframe.contentWindow.postMessage({type: 'subset', data: textInSelected, add: true},iframeDomain);
		}

		// apply selected font
		removeStyleTags(selector);
		addStyleTag(selector);
	}
}

/**
* Apply a style to a given set of elements
* @param {string} selector - the selector
* @param {string} font - the selected font
*/
function applyStyleToEl(selector, font) {
	var elements = document.querySelectorAll(selector);

	Array.prototype.forEach.call(elements, function (element){
		element.classList.remove('prototypo-outlined');
		element.classList.remove('prototypo-selected');
	});

	// asking iframe worker
	if (iframe) {
		var textInSelected = '';
		// getting every piece of text containing characters to load
		Array.prototype.forEach.call(elements, function(el) {
			textInSelected += el.innerText;
		});
		// sending a message to the iframe worker
		// in order to retrieve every character of selected fonts
		// will make the iframe worker send a message back
		iframe.contentWindow.postMessage({type: 'subset', data: textInSelected, add: true},iframeDomain);
	}

	// apply selected font
	removeStyleTags(selector);
	addStyleTag(selector);
}

/**
* Adds a style tag for a selector
* @param {string} selector - the selector
*/
function addStyleTag(selector) {
	var styleEl = document.createElement('style');
	var style = selector + ' {font-family: ' + selectedFont + ' !important; transition: background .2s ease, color .2s ease;}';
	styleEl.setAttribute('data-selector', selector.replace(/ /g,''));

	if (styleEl.stylesheet) {
		styleEl.stylesheet.cssText = style;
	} else {
		styleEl.appendChild(document.createTextNode(style));
	}
	document.head.appendChild(styleEl);
}

/**
* Removes all style tags for a selector
* @param {string} selector - the selector
*/
function removeStyleTags(selector) {
	var tags = document.getElementsByTagName('style');
	var trimedSelector = selector.replace(/ /g,'');
	var tagsToDelete = [];

	// here we have to loop over the tags and get the attribute 'by hand'
	// because querySelectorAll will not allow string containing special characters
	for(var i = 0; i < tags.length; i++) {
		if (tags[i].getAttribute('data-selector') === trimedSelector) {
			tagsToDelete.push(tags[i]);
		}
	}
	if (tagsToDelete.length > 0) {
		for(var i = 0; i < tagsToDelete.length; i++) {
			document.head.removeChild(tagsToDelete[i]);
		}
	}
}

/**
*	Stores the selected element in chrome storage
* @param {string} selector - concerned selector stored as a string
* @param {string} font - concerned font stored as a string
*/
function sendStoreElementMessage(selector, font) {
	sendMessageToBackground("store_element", {selector: selector, font: font});
}

/**
*	Stores the selected font in chrome storage
* @param {string} selectedFont - concerned font stored as a string
*/
function sendStoreSelectedFontMessage(selectedFont) {
	sendMessageToBackground("store_selected_font", {selectedFont: selectedFont});
}

/**
* A helper function to send a message to the background script
* @param {string} action - a string representing the action to be sent
* @param {object} message - a key:value message object
*/
function sendMessageToBackground(action, message) {
	if (typeof action === 'string') {
		// send a request to the background script
		chrome.runtime.sendMessage(
			{
				action: action,
				message: message
			}
		);
	} else {
		throw new Error('sendMessageToBackground - action (first parameter) must be of type string');
	}
}

/**
* Sets the iframe
*/
function setIframe() {
	iframe = document.createElement('iframe');
	// Must be declared at web_accessible_resources in manifest.json
	iframe.src = iframeDomain + 'iframe.html';
	// Some styles for a fancy sidebar
	iframe.style.cssText = 'position:fixed;top:0;left:0;display:block;' +
	'width:0px;height:0px;border:none;';
	document.body.appendChild(iframe);
}
