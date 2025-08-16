# tx_classify/urls.py
from django.urls import path
from .views import (
    UnclassifiedListView,
    ClassifySingleView,
    SplitTransactionView,
    ResplitTransactionView,          # NEW
    ReclassifyClassificationView,    # NEW
)

app_name = "tx_classify"

urlpatterns = [
    path("unclassified/", UnclassifiedListView.as_view(), name="unclassified"),
    path("classify/", ClassifySingleView.as_view(), name="classify"),
    path("split/", SplitTransactionView.as_view(), name="split"),
    path("resplit/", ResplitTransactionView.as_view(), name="resplit"),            # NEW
    path("reclassify/", ReclassifyClassificationView.as_view(), name="reclassify") # NEW
]
