import json
from django.shortcuts import render, get_object_or_404
from django.http import JsonResponse
from django.views.decorators.http import require_POST

from .models import Map, Submission
from .services.armorer import translate_pseudocode
from .services.vault import execute_in_vault


def hud(request, map_slug=None):
    if map_slug:
        map_obj = get_object_or_404(Map, slug=map_slug)
    else:
        map_obj = Map.objects.first()
    maps = Map.objects.all()
    return render(request, "core/hud.html", {"map": map_obj, "maps": maps})


@require_POST
def submit(request):
    data = json.loads(request.body)
    map_obj = get_object_or_404(Map, slug=data["map_slug"])
    pseudocode = data["pseudocode"]
    grid = data.get("grid_override") or map_obj.grid_json

    generated_python = translate_pseudocode(pseudocode)
    result = execute_in_vault(generated_python, grid)

    submission = Submission.objects.create(
        user=request.user if request.user.is_authenticated else None,
        map=map_obj,
        pseudocode=pseudocode,
        generated_python=generated_python,
        telemetry=result.get("path"),
        success=result.get("success", False),
        error_message=result.get("error", ""),
    )

    return JsonResponse({
        "success": submission.success,
        "path": submission.telemetry,
        "explored": result.get("explored"),
        "generated_code": generated_python,
        "error": submission.error_message,
        "time_ms": result.get("time_ms"),
    })
