from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from .models import Company, CompanyDocument
from .serializers import CompanySerializer, CompanyDocumentSerializer
from users.permissions_matrix_guard import RoleActionPermission

class CompanyViewSet(viewsets.ModelViewSet):
    serializer_class = CompanySerializer
    permission_classes = [IsAuthenticated, RoleActionPermission.for_module("companies")]

    def get_queryset(self):
        user = self.request.user
        role = getattr(user, "role", None)

        if role == "SUPER_USER" or getattr(user, "is_superuser", False):
            return Company.objects.all()

        # If the relation is present, scope by it; else show nothing
        companies_rel = getattr(user, "companies", None)
        if companies_rel:
            return Company.objects.filter(id__in=companies_rel.values_list("id", flat=True))
        return Company.objects.none()

    def destroy(self, request, *args, **kwargs):
        company = self.get_object()
        if hasattr(company, "is_active"):
            company.is_active = False
            company.save(update_fields=["is_active"])
            return Response({"detail": "Company marked as inactive."}, status=status.HTTP_204_NO_CONTENT)
        return super().destroy(request, *args, **kwargs)

    @action(
        detail=True,
        methods=["post"],
        url_path="upload_document",
        permission_classes=[IsAuthenticated, RoleActionPermission.for_module("companies", op="update")],
    )
    def upload_document(self, request, pk=None):
        company = self.get_object()
        files = request.FILES.getlist("documents")
        if not files:
            return Response({"error": "No files provided under key 'documents'."}, status=status.HTTP_400_BAD_REQUEST)
        if len(files) > 10:
            return Response({"error": "You can upload a maximum of 10 documents."}, status=status.HTTP_400_BAD_REQUEST)

        created = []
        for f in files:
            if f.size and f.size > 5 * 1024 * 1024:
                return Response({"error": f"{f.name} exceeds 5MB limit."}, status=status.HTTP_400_BAD_REQUEST)
            doc = CompanyDocument.objects.create(company=company, file=f)
            created.append(CompanyDocumentSerializer(doc).data)
        return Response({"uploaded": created}, status=status.HTTP_201_CREATED)

    @action(
        detail=False,
        methods=["post"],
        url_path="bulk_upload",
        permission_classes=[IsAuthenticated, RoleActionPermission.for_module("companies", op="create")],
    )
    def bulk_upload(self, request):
        file = request.FILES.get("file")
        if not file:
            return Response({"error": "No file uploaded"}, status=status.HTTP_400_BAD_REQUEST)

        import csv
        try:
            decoded = file.read().decode("utf-8").splitlines()
            reader = csv.DictReader(decoded)
        except Exception as e:
            return Response({"error": "Invalid CSV", "details": str(e)}, status=status.HTTP_400_BAD_REQUEST)

        results = []
        for i, row in enumerate(reader, start=1):
            ser = CompanySerializer(data=row)
            if ser.is_valid():
                ser.save()
                results.append({"row": i, "status": "success"})
            else:
                results.append({"row": i, "status": "error", "errors": ser.errors})
        return Response({"results": results}, status=status.HTTP_200_OK)


class CompanyDocumentViewSet(viewsets.ModelViewSet):
    serializer_class = CompanyDocumentSerializer
    permission_classes = [IsAuthenticated, RoleActionPermission.for_module("companies", op="update")]
    queryset = CompanyDocument.objects.all()

    def get_queryset(self):
        user = self.request.user
        qs = super().get_queryset()
        if getattr(user, "role", None) == "SUPER_USER" or getattr(user, "is_superuser", False):
            return qs
        companies_rel = getattr(user, "companies", None)
        if companies_rel:
            return qs.filter(company__in=companies_rel.all())
        return qs.none()

    def destroy(self, request, *args, **kwargs):
        document = self.get_object()
        document.delete()
        return Response({"detail": "Document deleted successfully."}, status=status.HTTP_204_NO_CONTENT)
