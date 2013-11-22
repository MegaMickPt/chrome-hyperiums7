$(document).ready(function () {
	function fillSelect(select, array) {
		$.each(array, function (value, text) {
			select.append($('<option>').val(value).text(text));
		});
	}

	fillSelect($('#productId'), Hyperiums7.products);
	fillSelect($('#governmentId'), Hyperiums7.governments);

	var theadTr = $('#units thead tr'),
		tfootTr = $('#units tfoot tr');
	$.each(Hyperiums7.races, function (raceId, raceName) {
		theadTr.append($('<th class="number">').text(raceName));
		tfootTr.append($('<td class="number">-</td>'));
	});
	theadTr.append($('<th class="number">Total</th>'));
	tfootTr.append($('<td class="number">-</td>'));

	

	var tbody = $('#units tbody');
	$.each(Hyperiums7.units, function (unitId, unitName) {
		var tr = $('<tr>').append(
			$('<th>').text(unitName)
		);
		$.each(Hyperiums7.races, function (raceId, raceName) {
			tr.append($('<td>').append(
				$('<input type="number" min="0">').data({
					unitId: unitId,
					raceId: raceId
				})
			));
		});
		tr.append('<td class="number">-</td>');
		tbody.append(tr);
	});

	$('input, select').on('input', function () {
		var pipes = Hyperiums7.races.map(function () { return []; }),
			planet = {
				governmentId: parseInt($('#governmentId').val()),
				productId: parseInt($('#productId').val()),
				stasis: parseInt($('[name="stasis"]:checked').val()),
				numFactories: parseInt($('#numFactories').val())
			};

		$('#units input').each(function (_, input) {
			input = $(input);
			pipes[input.data('raceId')].push({
				count: parseInt(input.val()) || 0,
				unitId: input.data('unitId')
			});
		});

		var total = {};
		$.each(pipes, function (raceId, pipe) {
			planet.raceId = raceId;
			$.each(Hyperiums7.getBuildPipeTotals(pipe, planet), function (key, value) {
				if (!total[key]) {
					total[key] = 0;
				}
				var text = '-';
				if (value > 0) {
					if (key == 'timeToBuild') {
						total[key] = Math.max(total[key], value);
						text = moment.duration(Math.ceil(value) * 3600000).format()
					} else {
						total[key] += value;
						text = numeral(value).format('0[.]0a')
					}
				}
				$('#' + key + ' td').eq(raceId).text(text);
			});
		});
		$.each(total, function (key, value) {
			var text = '-';
			if (value > 0) {
				if (key == 'timeToBuild') {
					text = moment.duration(Math.ceil(value) * 3600000).format()
				} else {
					text = numeral(value).format('0[.]0a');
				}
			}
			$('#' + key + ' td').eq(Hyperiums7.races.length).text(text);
		});
	});
});
