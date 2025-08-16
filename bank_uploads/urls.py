# bank_uploads/urls.py
from django.urls import path
from .views import UploadBankTransactionsView, BatchTransactionsView, RecentUploadsView

urlpatterns = [
    path('upload/', UploadBankTransactionsView.as_view(), name='upload-bank-transactions'),
    path('batch-transactions/', BatchTransactionsView.as_view(), name='batch-transactions'),
    path('recent-uploads/', RecentUploadsView.as_view(), name='recent-bank-uploads'),
]
