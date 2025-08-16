from rest_framework import viewsets
from rest_framework.parsers import MultiPartParser, FormParser
from .models import Receipt
from .serializers import ReceiptSerializer
from users.permissions import IsSuperUser

class ReceiptViewSet(viewsets.ModelViewSet):
    queryset = Receipt.objects.all().order_by('-date')
    serializer_class = ReceiptSerializer
    parser_classes = [MultiPartParser, FormParser]
    permission_classes = [IsSuperUser]
