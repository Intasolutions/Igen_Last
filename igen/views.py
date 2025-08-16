from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework import status
from django.utils import timezone
from datetime import timedelta, datetime
from companies.models import Company
from banks.models import BankAccount
from cost_centres.models import CostCentre
from transaction_types.models import TransactionType
from users.models import User
from projects.models import Project
from assets.models import Asset
from contacts.models import Contact
from vendors.models import Vendor
from properties.models import Property
from users.serializers import UserSerializer
from tx_classify.models import Classification
from django.db.models import Sum, Count
import logging
from django.conf import settings

# Set up logging
logger = logging.getLogger(__name__)

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def dashboard_stats(request):
    """
    Returns dashboard summary counts, financial metrics, and transaction trend data for authorized roles.
    """
    allowed_roles = ['SUPER_USER', 'CENTER_HEAD', 'PROPERTY_MANAGER']

    if not hasattr(request.user, 'role') or request.user.role not in allowed_roles:
        return Response(
            {'detail': '403 Forbidden – You are not authorized to view this dashboard.'},
            status=status.HTTP_403_FORBIDDEN
        )

    # 📊 Summary Counts
    total_users = User.objects.count()
    total_companies = Company.objects.count()
    total_projects = Project.objects.count()
    total_properties = Property.objects.count()
    total_assets = Asset.objects.count()
    total_contacts = Contact.objects.count()
    total_cost_centres = CostCentre.objects.count()
    total_banks = BankAccount.objects.count()
    total_vendors = Vendor.objects.count()
    total_transaction_types = TransactionType.objects.count()

    # 📈 Transaction Trend Data (last 30 days)
    try:
        end_date = timezone.now().date()
        start_date = end_date - timedelta(days=30)
        # Make dates timezone-aware
        start_datetime = timezone.make_aware(datetime.combine(start_date, datetime.min.time()))
        end_datetime = timezone.make_aware(datetime.combine(end_date, datetime.max.time()))
        logger.info(f"Querying Classification data from {start_datetime} to {end_datetime}")

        trend_data = Classification.objects.filter(
            created_at__gte=start_datetime,
            created_at__lte=end_datetime
        ).values('created_at__date').annotate(
            classified_count=Count('classification_id')
        ).order_by('created_at__date')

        logger.info(f"Raw trend data: {list(trend_data)}")

        # Create a list of all dates in the range
        all_dates = [start_date + timedelta(days=x) for x in range(31)]
        trend_dict = {item['created_at__date']: item['classified_count'] for item in trend_data}

        # Fill in missing dates with zero counts
        trend_data = [
            {
                'date': date.strftime('%Y-%m-%d'),
                'classified_count': trend_dict.get(date, 0)
            }
            for date in all_dates
        ]
        logger.info(f"Processed trend data: {trend_data}")
    except Exception as e:
        logger.error(f"Error fetching trend data: {str(e)}")
        return Response({'error': f"Failed to fetch trend data: {str(e)}"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    # 💰 Financial Metrics
    try:
        total_revenue = Classification.objects.filter(
            amount__gt=0,
            created_at__gte=start_datetime
        ).aggregate(total=Sum('amount'))['total'] or 0.0
        total_expenses = Classification.objects.filter(
            amount__lt=0,
            created_at__gte=start_datetime
        ).aggregate(total=Sum('amount'))['total'] or 0.0
        total_expenses = abs(total_expenses)
        # TODO: Replace with dynamic budget (e.g., from CostCentre or Budget model)
        budget = 1000000  # Replace with actual budget
        budget_utilization = (total_expenses / budget * 100) if budget > 0 else 0.0
    except Exception as e:
        logger.error(f"Error fetching financial metrics: {str(e)}")
        return Response({'error': f"Failed to fetch financial metrics: {str(e)}"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    response_data = {
        'total_users': total_users,
        'total_companies': total_companies,
        'total_projects': total_projects,
        'total_properties': total_properties,
        'total_assets': total_assets,
        'total_contacts': total_contacts,
        'total_cost_centres': total_cost_centres,
        'total_banks': total_banks,
        'total_vendors': total_vendors,
        'total_transaction_types': total_transaction_types,
        'trend_data': trend_data,
        'total_revenue': float(total_revenue),
        'total_expenses': float(total_expenses),
        'budget_utilization': round(float(budget_utilization), 1),
    }

    logger.info(f"Dashboard stats response: {response_data}")
    return Response(response_data)

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def spend_by_cost_centre(request):
    """
    Returns spend data for all cost centres, including those with zero spend.
    """
    try:
        # Try 'classifications' first (as defined in Classification model)
        spend_data = CostCentre.objects.annotate(
            total=Sum('classifications__amount')
        ).values('name', 'total').order_by('-total')
        # Convert to list, handle NULL totals as 0
        spend_data = [
            {'cost_centre': item['name'], 'total': abs(float(item['total'] or 0.0))}
            for item in spend_data
        ]
        logger.info(f"Spend by cost centre: {spend_data}")
        if len(spend_data) < CostCentre.objects.count():
            logger.warning(f"Only {len(spend_data)} cost centres have spend data, but {CostCentre.objects.count()} exist")
        return Response(spend_data)
    except Exception as e:
        logger.error(f"Error fetching spend data with 'classifications': {str(e)}")
        # Fallback to 'classification' if 'classifications' fails
        try:
            spend_data = CostCentre.objects.annotate(
                total=Sum('classification__amount')
            ).values('name', 'total').order_by('-total')
            spend_data = [
                {'cost_centre': item['name'], 'total': abs(float(item['total'] or 0.0))}
                for item in spend_data
            ]
            logger.info(f"Spend by cost centre (fallback 'classification'): {spend_data}")
            if len(spend_data) < CostCentre.objects.count():
                logger.warning(f"Only {len(spend_data)} cost centres have spend data, but {CostCentre.objects.count()} exist")
            return Response(spend_data)
        except Exception as e2:
            logger.error(f"Error fetching spend data with 'classification': {str(e2)}")
            return Response({'error': f"Failed to fetch spend data: {str(e2)}"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def top_vendors_by_spend(request):
    """
    Returns top 5 vendors by total spend.
    """
    try:
        # Placeholder: No direct relation between Vendor and Classification/BankTransaction
        logger.warning("Vendor spend query not implemented due to missing relationship")
        return Response({'message': 'Vendor spend data not available due to missing relationship'}, status=status.HTTP_200_OK)
    except Exception as e:
        logger.error(f"Error fetching vendor data: {str(e)}")
        return Response({'error': f"Failed to fetch vendor data: {str(e)}"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def user_list(request):
    """
    Returns a list of all users.
    """
    try:
        users = User.objects.all()
        serializer = UserSerializer(users, many=True)
        return Response(serializer.data)
    except Exception as e:
        logger.error(f"Error fetching user list: {str(e)}")
        return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def create_user(request):
    """
    Creates a new user with proper password handling.
    """
    data = request.data.copy()
    password = data.pop('password', None)
    serializer = UserSerializer(data=data)

    if serializer.is_valid():
        user = serializer.save()
        if password:
            user.set_password(password)
            user.save()
        return Response(UserSerializer(user).data, status=status.HTTP_201_CREATED)

    logger.error(f"User creation failed: {serializer.errors}")
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

@api_view(['DELETE'])
@permission_classes([IsAuthenticated])
def delete_user(request, pk):
    """
    Deletes a user by ID.
    """
    try:
        user = User.objects.get(pk=pk)
        user.delete()
        return Response({'message': 'User deleted'})
    except User.DoesNotExist:
        return Response({'error': 'User not found'}, status=status.HTTP_404_NOT_FOUND)