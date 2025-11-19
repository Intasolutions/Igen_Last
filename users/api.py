# users/api.py
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from .models import User

@api_view(["GET"])
@permission_classes([IsAuthenticated])   # or AllowAny if you want it public
def roles_list(request):
    # Return [{"id":"SUPER_USER","name":"Super User"}, ...]
    return Response([{"id": v, "name": n} for v, n in User.ROLE_CHOICES])

