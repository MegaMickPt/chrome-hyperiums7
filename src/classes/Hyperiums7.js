function Tick(name, atMinute, everyNthHour, startHour) {
	this.name = name;
	this.atMinute = atMinute;
	this.everyNthHour = everyNthHour || 1;
	this.startHour = startHour || 0;
}

Tick.prototype.getNextDate = function (serverDate) {
	var nextDate = new Date(serverDate);
	nextDate.setUTCMilliseconds(0);
	nextDate.setUTCSeconds(0);
	nextDate.setUTCMinutes(this.atMinute);

	if (serverDate.getUTCMinutes() >= this.atMinute) {
		nextDate.setUTCHours(nextDate.getUTCHours() + 1);
	}

	var h = (nextDate.getUTCHours() + 24 - this.startHour) % this.everyNthHour;
	if (this.everyNthHour > 1 && h) {
		nextDate.setUTCHours(nextDate.getUTCHours() + this.everyNthHour - h);
	}
	return nextDate;
};

var Hyperiums7 = {
	NAME: 'Hyperiums7',
	getSession: function () {
		var hyperiums = this,
			promise = $.Deferred();
		chrome.runtime.sendMessage({request: 'getCookie'}, function (cookie) {
			if (cookie) {
				var chunks = cookie.value.split('Z');
				promise.resolveWith(hyperiums, [{
					playerId: parseInt(chunks[0]),
					authKey: parseInt(chunks[1]),
					gameId: parseInt(chunks[2])
				}]);
			} else {
				promise.rejectWith(hyperiums, ['cookie is not set']);
			}
		});
		return promise;
	},
	getServletUrl: function (servlet) {
		return 'https://www.hyperiums.com/servlet/' + servlet;
	},
	getLogoutUrl: function () {
		return this.getServletUrl('Logout?logout_mode=&logout=Logout');
	},
	getRegisterUrl: function () {
		return this.getServletUrl('Login?creationform&defaultgame=3');
	},
	getLostPasswordUrl: function () {
		return this.getServletUrl('Login?lostpassword');
	},
	login: function (login, password) {
		var hyperiums = this,
			promise = $.Deferred();
		$.ajax({
			url: this.getServletUrl('Login'),
			data: {
				login: login,
				pwd: password,
				weblogin: 'Login',
				lang: 0
			},
			type: 'post'
		}).done(function (data, textStatus, jqXHR) {
			var errorMessage = $(data).find('.alert').text();
			if (errorMessage == '') {
				hyperiums.getSession().done(function (session) {
					promise.resolveWith(hyperiums, [session]);
				});
			} else {
				promise.rejectWith(hyperiums, [errorMessage]);
			}
		});
		return promise;
	},
	checkHtmlForEvents: function (html) {
		var doc = $(html), message = {
			request: 'updateNotifications',
			hasEvents: $('[href="/servlet/Planet?newplanetevents="].warn', doc).length == 1,
			events: [],
			hasBattleReport: $('[href="/servlet/Player?page=Reports"].alert', doc).length == 1,
			hasPersonalMessage: $('[rel="playerSubmenu"].warn', doc).length == 1,
			hasForumMessage: $('[rel="forumSubmenu"].warn', doc).length == 1,
		};

		$.each({
			hasEvents: this.getServletUrl('Planet?newplanetevents='),
			hasBattleReport: this.getServletUrl('Player?page=Reports'),
			hasPersonalMessage: this.getServletUrl('Player?page=Inbox'),
			hasForumMessage: this.getServletUrl('Forums?action=lastmsg&allforums=no')
		}, function (propName, url) {
			if (location.href == url) {
				message[propName] = false;
			}
		});

		if (message.hasEvents) {
			if ($('[name="ackallpendingevents"]', doc).length == 0) {
				this.getNewEvents().done(function (events) {
					message.events = events;
					chrome.runtime.sendMessage(message);
				});
				return;
			}
			message.events = this.getEventsFromHtml(html);
		}
		chrome.runtime.sendMessage(message);
	},
	getNewEvents: function () {
		var hyperiums = this,
			promise = $.Deferred();
		this.ajax(this.getServletUrl('Planet?newplanetevents=')).
			done(function (data, textStatus, jqXHR) {
				promise.resolveWith(hyperiums, [hyperiums.getEventsFromHtml(data)]);
			});
		return promise;
	},
	getEventsFromHtml: function (html) {
		var doc = $(html), events = [];
		$('.tinytext', doc).each(function () {
			events.push({
			date: new Date($(this).text() + ' +00:00'),
			message: $(this).next().text().replace(/^System message: /, '')
			});
		});
		return events;
	},
	getFleetsInfo: function (args) {
		var promise = $.Deferred();
		args = args || {};
		args.planet = args.planet || '*';
		args.data = args.data || 'own_planets';
		args.request = 'getfleetsinfo';
		this.hapi(args).done(function (pairs) {
			var planets = [];
			planets.toNames = {};
			$.each(pairs, function (key, value) {
				var i, j, keys = /^([^\.]+?)(\d+)(\.(\d+))?$/.exec(key)
				if (keys && keys.length) {
					key = keys[1];
					i = parseInt(keys[2]); // planet index
					j = parseInt(keys[4]); // fleet index

					if (!planets[i]) {
						planets[i] = {fleets: []};
					}

					switch (key) {
					case 'nrj':
					case 'nrjmax':
					case 'bomb':
					case 'carmies':
					case 'crui':
					case 'delay':
					case 'dest':
					case 'fleetid':
					case 'frace':
					case 'garmies':
					case 'scou':
					case 'sellprice':
					case 'starb':
						value = parseFloat(value);
						break;
					case 'isneutral':
					case 'stasis':
					case 'vacation':
					case 'autodrop':
					case 'bombing':
					case 'camouf':
					case 'defend':
						value = value == '1';
						break;
					case 'planet':
					case 'fname':
					case 'owner':
						break;
					default:
						throw 'unkown key ' + key + ' (' + value + ')';
					}

					switch (key) {
					case 'planet': key = 'name'; break;
					case 'isneutral': key = 'neutral'; break;
					case 'bomb': key = 'numBombers'; break;
					case 'crui': key = 'numCruisers'; break;
					case 'dest': key = 'numDestroyers'; break;
					case 'scou': key = 'numScouts'; break;
					case 'starb': key = 'numStarbases'; break;
					case 'camouf': key = 'camouflage'; break;
					case 'carmies': key = 'numCarriedArmies'; break;
					case 'fleetid': key = 'id'; break;
					case 'fname': key = 'name'; break;
					case 'frace': key = 'raceId'; break;
					case 'garmies': key = 'numGroundArmies'; break;
					}

					if (isNaN(j)) {
						planets[i][key] = value;
						if (key == 'name') {
							planets.toNames[value] = planets[i];
						}
					} else {
						if (!planets[i].fleets[j]) {
							planets[i].fleets[j] = {isForeign: true};
						}
						planets[i].fleets[j][key] = value;
						if (key == 'name') {
							planets[i].fleets[j].isForeign = false;
						}
					}
				} else {
					planets[key] = value;
				}
			});
			promise.resolveWith(this, [planets]);
		});
		return promise;
	},
	hapi: function (args) {
		var promise = $.Deferred(), hyperiums = this;
		this.getSession().done(function (session) {
			args.gameid = args.gameid || session.gameId;
			args.playerid = args.playerid || session.playerId;
			args.authkey = args.authkey || session.authKey;
			hyperiums.ajax({
				url: this.getServletUrl('HAPI'),
				data: args
			}).done(function (data, textStatus, jqXHR) {
				var pairs = {};
				$.each(data.split('&'), function (_, pair) {
					var split = pair.split('=');
					pairs[split[0]] = split[1];
				});
				promise.resolveWith(this, [pairs]);
			});
		});
		return promise;
	},
	getBattleReports: function () {
		var promise = $.Deferred(),
			hyperiums = this;
		this.ajax(this.getServletUrl('Player?page=Reports')).
			done(function (data, textStatus, jqXHR) {
				var reports = [];
				$('input[type=checkbox]', data).each(function (i, element) {
					var matches;
					element = $(element);
					if (/^r\d+$/.test(element.attr('name'))) {
						matches = /^(\d\d\d\d\-\d\d-\d\d \d\d:\d\d:\d\d)Planet (.+)$/.exec(element.closest('td').next().text());
						reports.push({
							id: parseInt(element.val()),
							date: new Date(matches[1] + ' +00:00'),
							planetName: matches[2]
						});
					}
				});
				promise.resolveWith(hyperiums, [reports]);
			});
		return promise;
	},
	ticks: [
		new Tick('Build', 47),
		new Tick('Cash', 55, 8, 4),
		new Tick('Move', 50),
		new Tick('Control', 50),
		new Tick('N/A', 30),
		new Tick('Battle', 30, 2),
		new Tick('Energy', 42),
		new Tick('Planet', 49, 12)
	].sort(function (a, b) {
		return a.name.localeCompare(b.name);
	}),
	races: ['Human', 'Azterk', 'Xillor'],
	products: ['Agro', 'Minero', 'Techno'],
	governments: ['Dictatorial', 'Authoritarian', 'Democratic', 'Hyp.protect.'],
	govs: ['Dict.', 'Auth.', 'Demo.', 'Hyp.'],
	units: ['Factories', 'Destroyers', 'Cruisers', 'Scouts', 'Bombers', 'Starbases', 'Ground Armies', 'Carried Armies'],
	spaceAvgP: [
		// [Human, Azterk, Xillor, Hyperiums, Average]
		[0, 0, 0, 0, 0], // Factories
		[56, 73, 67, 0, 65], // Destroyers
		[319, 393, 475, 0, 396], // Cruisers
		[8, 6, 7, 0, 7], // Scouts
		[66, 85, 105, 0, 85], // Bombers
		[2583, 2583, 2583, 0, 2583], // Starbases
		[0, 0, 0, 0, 0], // Ground Armies
		[0, 0, 0, 0, 0] // Carried Armies
	],
	// [Human, Azterk, Xillor, Hyp]
	groundAvgP: [300, 360, 240, 0, 300],
	armyCapacity: [
		0, // Factories
		1, // Destroyerss
		1, // Cruisers
		0, // Scouts
		3, // Bombers
		2000, // Starbases
		0, // Ground Armies
		0 // Carried Armies
	],
	upkeepCosts: [
		// [Human, Azterk, Xillor]
		[1800, 1900, 2100], // Factories
		[1000, 1000, 1000], // Destroyers
		[7200, 7200, 7200], // Cruisers
		[150, 150, 150], // Scouts
		[1000, 1000, 1000], // Bombers
		[100000, 100000, 100000], // Starbases
		[2000, 2000, 2000], // Ground Armies
		[3000, 3000, 3000] // Carries Armies
	],
	buildCosts: [
		// [Agro, Minero, Techno]
		[40000, 40000, 40000], // Factories
		[10000, 8500, 7500], // Destroyers
		[60000, 51000, 45000], // Cruisers
		[1500, 1275, 1125], // Scouts
		[25000, 21250, 18750], // Bombers
		[2000000, 1700000, 1500000], // Starbases
		[0, 0, 0], // Ground Armies
		[0, 0, 0] // Carried Armies
	],
	timeToBuild: [ // ticks with 1 factorie, no stasis
		// [Human, Azterk, Xillor]
		[11, 12, 13], // Factories
		[4, 8.08, 13], // Destroyers
		[25, 50, 85], // Cruiseres
		[1, 1, 2], // Scouts
		[5, 7, 10], // Bombers
		[0, 0, 0], // Starbases
		[0, 0, 0], // Ground Armies
		[0, 0, 0] // Carried Armies
	],
	timeToBuildMultiplier: {
		// [Dict., Auth., Demo.]
		governments: [0.8, 1, 1],
		// [Agro, Minero, Techno
		products: [1, 1, 0.85],
		// [off, on]
		stasis: [1, 3]
	},
	getPlanetInfo: function (args) {
		var promise = $.Deferred();
		args = args || {};
		args.planet = args.planet || '*';
		args.data = args.data || 'general';
		args.request = 'getplanetinfo';
		this.hapi(args).done(function (pairs) {
			var planets = []
			planets.ids = [];
			$.each(pairs, function (key, value) {
				var i, keys = /^(.+?)_?(\d+)$/.exec(key);
				if (keys && keys.length) {
					key = keys[1];
					i = parseInt(keys[2]);

					if (!planets[i]) {
						planets[i] = {};
					}

					switch (key) {
					case 'activity':
					case 'block':
					case 'civlevel':
					case 'defbonus':
					case 'ecomark':
					case 'expinpipe':
					case 'exploits':
					case 'factories':
					case 'gov':
					case 'govd':
					case 'nexus':
					case 'nrj':
					case 'nrjmax':
					case 'nxbuild':
					case 'nxbtot':
					case 'orbit':
					case 'planetid':
					case 'pop':
					case 'ptype':
					case 'purif':
					case 'race':
					case 'sc':
					case 'size':
					case 'tax':
					case 'x':
					case 'y':
					case 'counterinfiltr':
						value = parseFloat(value);
						break;
					case 'bhole':
					case 'stasis':
					case 'parano':
						value = value == '1';
						break;
					case 'planet':
					case 'publictag':
					case 'tag1':
					case 'tag2':
						break;
					default:
						throw 'unkown key ' + key + ' (' + value + ')';
					}

					switch (key) {
					case 'bhole': key = 'isBlackholed'; break;
					case 'civlevel': key = 'civ'; break;
					case 'ecomark': key = 'eco'; break;
					case 'expinpipe': key = 'numExploitsInPipe'; break;
					case 'exploits': key = 'numExploits'; break;
					case 'factories': key = 'numFactories'; break;
					case 'gov': key = 'governmentId'; break;
					case 'govd': key = 'governmentDaysLeft'; break;
					case 'planet': key = 'name'; break;
					case 'planetid': key = 'id'; break;
					case 'ptype': key = 'productId'; break;
					case 'publictag': key = 'tag'; break;
					case 'purif': key = 'purificationHoursLeft'; break;
					case 'race': key = 'raceId'; break;
					case 'counterinfiltr': key = 'counterInfiltration'; break;
					}

					planets[i][key] = value;
					if (key == 'id') {
						planets.ids[value] = planets[i];
					}
				} else {
					planets[key] = value;
				}
			});
			promise.resolveWith(this, [planets]);
		});
		return promise;
	},
	getTimeToBuildMultiplier: function (planet) {
		return this.timeToBuildMultiplier.governments[planet.governmentId] *
			this.timeToBuildMultiplier.products[planet.productId] *
			this.timeToBuildMultiplier.stasis[planet.stasis ? 1 : 0];
	},
	getBuildPipeTotals: function (pipe, planet, numDaysOfWar) {
		var totals = {
			timeToBuild: 0,
			upkeepCosts: 0,
			buildCosts: 0,
			spaceAvgP: 0,
			groundAvgP: 0,
			spaceUpkeepCosts: 0,
			spaceBuildCosts: 0,
			groundUpkeepCosts: 0
		},
			multiplier = this.getTimeToBuildMultiplier(planet),
			numFactories = planet.numFactories,
			raceId = planet.raceId,
			productId = planet.productId,
			factoryUnitId = this.units.indexOf('Factories'),
			hyperiums = this;

		$.each(pipe, function (_, order) {
			if (order.unitId == factoryUnitId) {
				totals.timeToBuild += Math.log((order.count + numFactories) / numFactories) /
					Math.log(1 + 1 / hyperiums.timeToBuild[order.unitId][raceId] / multiplier);
				numFactories += order.count;
			} else {
				totals.timeToBuild += order.count * multiplier / numFactories *
					hyperiums.timeToBuild[order.unitId][raceId];
			}

			var upkeepCosts =  order.count *
				hyperiums.upkeepCosts[order.unitId][raceId];
			var buildCosts = order.count *
				hyperiums.buildCosts[order.unitId][productId];

			totals.upkeepCosts += upkeepCosts;
			totals.buildCosts += buildCosts;
			if (order.unitId != factoryUnitId) {
				if (hyperiums.spaceAvgP[order.unitId][raceId] == 0) {
					totals.groundAvgP += order.count *
						hyperiums.groundAvgP[raceId];
					totals.groundUpkeepCosts += upkeepCosts;
				} else {
					totals.spaceAvgP += order.count *
						hyperiums.spaceAvgP[order.unitId][raceId];
					totals.spaceUpkeepCosts += upkeepCosts;
					totals.spaceBuildCosts += buildCosts;
				}
			}
		});

		totals.fleetLevel = Math.floor(Math.sqrt(0.03 * (numDaysOfWar *
			totals.spaceUpkeepCosts + totals.spaceBuildCosts) / 10000000));
		totals.gaLevel = Math.max(3, Math.floor((Math.sqrt(0.12 * numDaysOfWar *
			totals.groundUpkeepCosts / 10000000 + 9) + 3) / 2));

		return totals;
	},
	getPlanetIdInfluence: function (planetId) {
		var promise = $.Deferred(), hyperiums = this;
		this.ajax({
			url: this.getServletUrl('Planet'),
			data: {
				cancelabandon: '',
				planetid: planetId
			}
		}).done(function (data, textStatus, jqXHR) {
			promise.resolveWith(hyperiums, [
				parseFloat($('.planetName', $(data)).siblings('b').text().replace(/,/g, ''))
			]);
		});
		return promise;
	},
	searchPlanets: function (pattern) {
		var promise = $.Deferred(), hyperiums = this;
		this.ajax({
			url: this.getServletUrl('Maps'),
			data: {
				searchplanets: pattern,
				search: 'Search'
			}
		}).done(function (data, textStatus, jqXHR) {
			promise.resolveWith(hyperiums, [
				hyperiums.getPlanetsFromTradingMap(data)
			]);
		}).fail(function () {
			promise.rejectWith(hyperiums);
		});
		return promise;
	},
	getPlanetsFromTradingMap: function (html) {
		var planets = [];
		$('table.stdArray tr:not(.stdArray)', html).each(function (_, element) {
			planets.push(Hyperiums7.getPlanetFromTradingMapRow($(element)));
		});
		return planets.sort(function (a, b) {
			return a.name.localeCompare(b.name);
		});
	},
	getPlanetFromTradingMapRow: function (tr) {
		var tds = tr.find('td'),
			msgUrl = tds.eq(0).find('a[href^="Maps"]').attr('href'),
			planet = {
				id: msgUrl ? parseFloat(msgUrl.replace(/[^\d]+/g, '')) : undefined,
				name: $.trim(tds.eq(0).text().replace(/^@/, '')),
				isOwn: tds.eq(0).find('.grayed b, .std b').length == 1,
				tag: tds.eq(1).text(),
				civ: parseInt(tds.eq(3).text()) || 0,
				govName: tds.eq(4).text(),
				raceName: tds.eq(5).text(),
				distance: parseInt(tds.eq(6).text()),
				productName: tds.eq(7).text(),
				activity: parseInt(tds.eq(8).text().replace(',', '')) || 0,
				freeCapacity: parseInt(tds.eq(9).text().replace(',', '')) || 0,
				isBlackholed: tr.hasClass('alertLight'),
				isDoomed: tr.find('img[src$="death1.gif"]').length == 1,
				daysBeforeAnnihilation: 0
			};

		if (planet.isDoomed) {
			planet.daysBeforeAnnihilation = parseFloat(tr.find('img[src$="death1.gif"]').attr('onmouseover').replace(/[^\d]+/g, ''));
		}

		if (planet.raceName == '') {
			planet.raceName = tds.eq(5).find('img').attr('src').
				replace(/^.*_(.*)\.gif$/, '$1');
		}

		var coords = /^(SC\d+)?\((-?\d+),(-?\d+)\)$/i.exec(tds.eq(2).text());
		if (coords.length) {
			planet.x = parseInt(coords[2]);
			planet.y = parseInt(coords[3]);
		}
		return planet;
	},
	getContacts: function () {
		var promise = $.Deferred(), hyperiums = this;
		this.ajax(this.getServletUrl('Player?page=Contacts')).
			done(function (data, textStatus, jqXHR) {
				var players = [];
				players.toNames = {};

				$('table.stdArray > tbody', data).eq(0).children('tr:not(#stdArray)').
					each(function (_, element) {
						var tr = $(element),
							tds = $(element).children('td'),
							type = 'neutral';

						$.each(['buddy', 'friendly', 'hostile'], function (_, className) {
							if (tr.hasClass(className)) {
								type = className;
							}
						});

						var player = {
							id: parseInt(tds.eq(0).find('a').eq(0).attr('href').replace(/[^\d]+/g, '')),
							name: $.trim(tds.eq(0).find('a').eq(1).text()),
							type: type
						};
						players.push(player);
						players.toNames[player.name] = player;
					});

				promise.resolveWith(hyperiums, [players.sort(function (a, b) {
					return a.name.localeCompare(b.name);
				})]);
			}).
			fail(function () {
				promise.rejectWith(hyperiums);
			});
		return promise;
	},
	getMovingFleets: function () {
		var promise = $.Deferred(), hyperiums = this;
		this.ajax(this.getServletUrl('Fleets?pagetype=moving_fleets')).done(function (data) {
			hyperiums.getMovingFleetsFromHtml(data).done(function (fleets) {
				promise.resolveWith(hyperiums, [fleets]);
			});
		});
		return promise;
	},
	getMovingFleetsFromHtml: function (html) {
		var fleets = [], planetNames = [], promise = $.Deferred(), hyperiums = this;
		fleets.toNames = {};
		fleets.fromNames = {};
		$('td[width="430"]', html).each(function (_, element) {
			element = $(element);
			var bold = element.find('b'),
				fleet = {
					eta: parseFloat(bold.eq(-1).text()),
					delay: parseInt(element.find('.info b').text().replace(/ .+$/, '')) || 0,
					numDestroyers: 0,
					numCruisers: 0,
					numScouts: 0,
					numBombers: 0,
					numStarbases: 0,
					numCarriedArmies: 0,
					raceId: hyperiums.races.indexOf(element.find('img').eq(0).
						attr('src').replace(/.*_([a-z]+?)\.gif$/i, '$1')),
					from: { name: bold.eq(-3)[0].previousSibling.nodeValue.replace(/^.+  ([^ ]+) .+$/, '$1') },
					to: { name: bold.eq(-3).text().replace(/ \[.+\]$/,'') },
					id: parseFloat(element.next().find('input[type="checkbox"]').val())
				};

			if (fleet.from.name.indexOf(' ') > -1) { // no valid from name
				fleet.from = fleet.to;
			}

			element.find('[src$="_icon.gif"]').each(function (_, element) {
				var key = $(element).attr('src').replace(/.*\/([a-z]+?)_icon\.gif$/i, '$1');
				switch (key) {
				case 'destroyer': key = 'numDestroyers'; break;
				case 'cruiser': key = 'numCruisers'; break;
				case 'scout': key = 'numScouts'; break;
				case 'bomber': key = 'numBombers'; break;
				case 'starbase': key = 'numStarbases'; break;
				case 'fleetarmy': key = 'numCarriedArmies'; break;
				}

				if (key) {
					fleet[key] = parseFloat(element.previousSibling.nodeValue.
						replace(/[^\d]+/g, '')
					);
				}

				if (key == 'numCarriedArmies') {
					fleet.autodrop = element.nextSibling.nodeValue == ' (auto drop)';
				}
			});

			fleets.push(fleet);
			if (!fleets.toNames[fleet.to.name]) {
				fleets.toNames[fleet.to.name] = [];
			}
			fleets.toNames[fleet.to.name].push(fleet);
			if (!fleets.fromNames[fleet.from.name]) {
				fleets.fromNames[fleet.from.name] = [];
			}
			fleets.fromNames[fleet.from.name].push(fleet);
			planetNames.push(fleet.to.name);
			planetNames.push(fleet.from.name);
		});

		this.searchPlanets($.unique(planetNames).join(', ')).
			done(function (planets) {
				$.each(planets, function (_, planet) {
					$.each(fleets.toNames[planet.name] || [], function (_, fleet) {
						fleet.to = planet;
					});
					$.each(fleets.fromNames[planet.name] || [], function (_, fleet) {
						fleet.from = planet;
					});
				});
				promise.resolveWith(hyperiums, [fleets]);
			});
		return promise;
	},
	updateFleetAvgP: function (fleet) {
		fleet.spaceAvgP =
			(fleet.numDestroyers || 0) * this.spaceAvgP[1][fleet.raceId] +
			(fleet.numCruisers || 0) * this.spaceAvgP[2][fleet.raceId] +
			(fleet.numScouts || 0) * this.spaceAvgP[3][fleet.raceId] +
			(fleet.numBombers || 0) * this.spaceAvgP[4][fleet.raceId] +
			(fleet.numStarbases || 0) * this.spaceAvgP[5][fleet.raceId];
		fleet.groundAvgP =
			(fleet.numGroundArmies || 0) * this.groundAvgP[fleet.raceId] +
			(fleet.numCarriedArmies || 0) * this.groundAvgP[fleet.raceId];
		
	},
	getControlledPlanets: function () {
		var promise = $.Deferred(), hyperiums = this;
		this.ajax(this.getServletUrl('Home')).done(function (data) {
			var planets = [];
			planets.numPlanets = 0;
			$('.planet', data).each(function (_, element) {
				element = $(element);
				var highlights = element.closest('table').find('.highlight'),
					planet = {
						governmentId: hyperiums.governments.indexOf(
							highlights.eq(0).text().replace(/ \(\d+\)$/, '')
						),
						id: parseFloat(element.attr('href').replace(/[^\d]+/, '')),
						name: element.text(),
						raceId: hyperiums.races.indexOf(highlights.eq(2).text()),
						productId: hyperiums.products.indexOf(highlights.eq(1).text()),
						stasis: element.closest('table').find('[src$="stasis_icon.png"]').length == 1
					};
					planets[planet.id] = planet;
					planets.numPlanets++;
			});
			promise.resolveWith(hyperiums, [planets]);
		});
		return promise;
	},
	getForeignPlanets: function () {
		var promise = $.Deferred(), hyperiums = this;
		this.ajax(this.getServletUrl('Fleets?pagetype=foreign_fleets')).done(function (data) {
			var planets = [];
			$('.planetName', data).each(function (_, element) {
				planets.push({
					name: $(element).text()
				});
			});
			promise.resolveWith(hyperiums, [planets]);
		});
		return promise;
	},
	getStatisticsRowsFromPlanets: function (planets) {
		function createEmptyStats(name) {
			return {
				count: 0,
				name: name,

				'Auth.': 0,
				'Demo.': 0,
				'Dict.': 0,
				'Hyp.': 0,

				'Azterk': 0,
				'Human': 0,
				'Xillor': 0,

				'Agro': 0,
				'Minero': 0,
				'Techno': 0
			};
		}

		var stats = createEmptyStats('Total'),
			tagIndex = {};

		stats.tags = [];
		$.each(planets, function (_, planet) {
			if (tagIndex[planet.tag] === undefined) {
				tagIndex[planet.tag] = stats.tags.push(createEmptyStats(planet.tag)) - 1;
			}

			$.each([
				stats,
				stats.tags[tagIndex[planet.tag]]
			], function(_, stats) {
				stats.count++;
				if (planet.isBlackholed) {
					return;
				}
				stats[planet.govName]++;
				stats[planet.raceName]++;
				stats[planet.productName]++;
				$.each(['civ', 'activity', 'freeCapacity'], function (_, key) {
					if (!stats[key]) {
						stats[key] = {min: Number.MAX_VALUE, max: 0, total: 0, count: 0};
					}
					stats[key].count++;
					stats[key].min = Math.min(stats[key].min, planet[key]);
					stats[key].total += planet[key];
					stats[key].max = Math.max(stats[key].max, planet[key]);
				});
			});
		});

		function createStatsTr(stats) {
			return $('<tr>').append([
				$('<td>').text(stats.name),
				$('<td class="hr">').text(stats.count + ' Planet(s)'),
				$('<td class="hc">Min<br>Avg/Total<br>Max</td>'),
				$('<td class="hc">').append([
					stats.civ.min, '<br>',
					numeral(stats.civ.total / stats.count).format('0[.]0'), '<br>',
					stats.civ.max
				]),
				$('<td class="hc">').append([
					stats['Auth.'], ' A<br>',
					stats['Demo.'], ' De<br>',
					stats['Dict.'], ' Di<br>',
					stats['Hyp.'], ' H'
				]),
				$('<td class="hc">').append([
					stats['Azterk'], ' A<br>',
					stats['Human'], ' H<br>',
					stats['Xillor'], ' X<br>'
				]),
				$('<td class="hc">-</td>'),
				$('<td class="hr">').append([
					stats['Agro'], ' A<br>',
					stats['Minero'], ' M<br>',
					stats['Techno'], ' T'
				]),
				$('<td class="hr">').append([
					numeral(stats.activity.min).format('0,0'), '<br>',
					numeral(stats.activity.total / stats.count).format('0,0'), '<br>',
					numeral(stats.activity.max).format('0,0')
				]),
				$('<td class="hr">').append([
					numeral(stats.freeCapacity.min).format('0,0'), '<br>',
					numeral(stats.freeCapacity.total / stats.count).format('0,0'), '/',
					numeral(stats.freeCapacity.total).format('0,0'), '<br>',
					numeral(stats.freeCapacity.max).format('0,0')
				])
			]).mouseover(function () {
				$(this).addClass('lineCenteredOn');
			}).mouseout(function () {
				$(this).removeClass('lineCenteredOn');
			});
		}

		stats.tags.sort(function (a, b) {
			var diff = b.count - a.count;
			if (diff == 0) {
				return a.name.localeCompare(b.name);
			}
			return diff;
		});

		var trs = [];
		$.each([
			stats,
			stats.tags
		], function (_, stats) {
			if ($.isArray(stats)) {
				$.each(stats, function (i, stats) {
					trs.push(createStatsTr(stats).addClass('line' + (++i % 2)));
				});
			} else {
				trs.push(createStatsTr(stats).addClass('stdArray'));
			}
		});

		return trs;
	},
	getTradingOverview: function () {
		var promise = $.Deferred(), hyperiums = this;
		this.ajax(this.getServletUrl('Trading')).done(function (data) {
			var planets = [];
			$('.planetName', data).each(function (_, element) {
				element = $(element);
				var planet = {
					id: parseFloat(element.attr('href').replace(/[^\d]+/g, '')),
					name: element.text(),
					wtr: parseInt(element.parent().
						find('table table:not(.civ) b').text().replace('%', ''))
				}
				planets[planet.id] = planet;
			});
			promise.resolveWith(hyperiums, [planets]);
		});
		return promise;
	},
	ajax: function (url, settings) {
		settings = settings || url;

		if (typeof settings == 'string') {
			settings = {url: settings};
		} else {
			settings.url = settings.url || url;
		}

		settings.data = settings.data || '';
		if (typeof settings.data != 'string') {
			settings.data = $.param(settings.data, settings.traditional || false);
		}

		url = settings.url;
		if (settings.data.length) {
			url += '?' + settings.data;
			settings.data = '';
		}

		var promise = $.Deferred(), hyperiums = this;
		chrome.runtime.sendMessage({
			request: 'getAjaxCache',
			url: url,
			settings: settings
		}, function (data) {
			promise.resolveWith(hyperiums, [data]);
		});
		return promise;
	},
	getFleetsUpkeep: function () {
		var promise = $.Deferred(), hyperiums = this;

		this.getPlayerInfo().done(function (player) {
			var upkeep = {
				unitCosts: 0,
				numDeployed: 0
			};

			function addFleets(fleets, isDeployed) {
				$.each(fleets, function (_, fleet) {
					if (
						fleet.owner === undefined ||
						fleet.owner == player.name
					) {
						if (isDeployed) {
							upkeep.numDeployed++;
						}

						$.each(hyperiums.units, function(unitId, unitName) {
							var numUnits = fleet['num' + unitName.replace(' ', '')] || 0;
							upkeep.unitCosts += numUnits * hyperiums.upkeepCosts[unitId][fleet.raceId];
							if (unitName == 'Starbases') {
								upkeep.numDeployed += numUnits * 10;
							}
						});
					}
				});
			}

			var numLoading = 3;
			$.each({'own_planets': false, 'foreign_planets': true}, function (data, isDeployed) {
				hyperiums.getFleetsInfo({data: data}).done(function (planets) {
					$.each(planets, function (_, planet) {
						addFleets(planet.fleets, isDeployed);
					});
					if (--numLoading == 0) {
						promise.resolveWith(this, [upkeep]);
					}
				});
			});

			this.getMovingFleets().done(function (fleets) {
				addFleets(fleets, true);
				if (--numLoading == 0) {
					promise.resolveWith(this, [upkeep]);
				}
			});
		});

		return promise;
	},
	getPlayerInfo: function () {
		return this.hapi({
			request: 'getplayerinfo'
		});
	},
	getGaRates: function () {
		var promise = new $.Deferred(), hyperiums = this;
		this.ajax(this.getServletUrl('Fleets?pagetype=factories')).done(function (data) {
			var planets = [];
			$('.highlight', data).each(function (_, element) {
				element = $(element);
				var planetId = parseFloat(element.closest('form').find('input[name="planetid"]').val()),
					planet = {
						id: planetId,
						gaRate: parseFloat(element.text().replace(/[^0-9\.]+/g, ''))
					};
				planets[planetId] = planet;
			});
			promise.resolveWith(hyperiums, [planets]);
		});
		return promise;
	},
	dropStasis: function (planetId) {
		var promise = $.Deferred(), hyperiums = this;
		$.ajax({
			url: this.getServletUrl('Floatorders'),
			data: {
				cancelstasis: 'Drop stasis field',
				planetid: planetId
			},
			type: 'post'
		}).done(function () {
			promise.resolveWith(hyperiums);
		});
		return promise;
	},
	enableStasis: function (planetId) {
		var promise = $.Deferred(), hyperiums = this;
		$.ajax({
			url: this.getServletUrl('Floatorders'),
			data: {
				enablestasis: 'Enable stasis field',
				planetid: planetId
			},
			type: 'post'
		}).done(function () {
			promise.resolveWith(hyperiums);
		});
		return promise;
	},
	searchForums: function (query, offset, limit) {
		var promise = $.Deferred();
		offset = offset || 0;
		limit = limit || 30;
		$.get('http://hyperiums.resident-uhlig.de/api.php/forum/search', { query: query, offset: offset, limit: limit })
			.done(function (result) {
				if (!result || !result.rows) {
					promise.reject('Error: no result rows');
					return;
				}

				if (result.rows.length === 0) {
					promise.reject('No results.');
					return;
				}
				
				promise.resolve(result);
			})
			.fail(function (xhr, status, error) {
				status = status || '';
				error = error || '';
				promise.reject('Error: ' + status + ' ' + error);
			});
		
		return promise;
	}
};

