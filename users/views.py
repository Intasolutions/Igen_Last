from rest_framework import viewsets, status
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework.decorators import action
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework.filters import OrderingFilter  # ✅ for server-side ordering

from .models import User
from .serializers import UserSerializer


class UserViewSet(viewsets.ModelViewSet):
    """
    Handles all CRUD operations for users, including custom actions
    like password reset, deactivation, soft delete, and restore.
    """
    serializer_class = UserSerializer
    permission_classes = [IsAuthenticated]

    # ✅ filtering + ordering
    filter_backends = [DjangoFilterBackend, OrderingFilter]
    filterset_fields = ['role']
    ordering_fields = ['created_at', 'full_name', 'user_id', 'is_active']
    ordering = ['-created_at']  # ✅ newest first by default

    # Default queryset excludes soft-deleted users via the model's default manager
    queryset = User.objects.all().order_by('-created_at')

    def get_queryset(self):
        """
        Optionally include soft-deleted users with ?include_deleted=true (read-only listing).
        Always apply the same default ordering.
        """
        include_deleted = (self.request.query_params.get('include_deleted') or '').lower() in ('1', 'true', 'yes')
        if include_deleted:
            return User.all_objects.all().order_by(*self.ordering)
        return super().get_queryset().order_by(*self.ordering)

    def create(self, request, *args, **kwargs):
        """
        Creates a new user. Let the serializer handle password hashing.
        """
        try:
            data = request.data.copy()

            # Ensure required fields are present
            if not data.get('user_id') or not data.get('password'):
                return Response(
                    {'detail': 'Both user_id and password are required'},
                    status=status.HTTP_400_BAD_REQUEST
                )

            serializer = self.get_serializer(data=data)
            serializer.is_valid(raise_exception=True)
            self.perform_create(serializer)

            return Response(serializer.data, status=status.HTTP_201_CREATED)

        except Exception as e:
            return Response(
                {'detail': f'Error creating user: {str(e)}'},
                status=status.HTTP_400_BAD_REQUEST
            )

    def update(self, request, *args, **kwargs):
        """
        Updates user info. Serializer handles password hashing if provided.
        """
        try:
            instance = self.get_object()
            serializer = self.get_serializer(instance, data=request.data, partial=True)
            serializer.is_valid(raise_exception=True)
            self.perform_update(serializer)

            return Response(serializer.data)

        except Exception as e:
            return Response(
                {'detail': f'Error updating user: {str(e)}'},
                status=status.HTTP_400_BAD_REQUEST
            )

    @action(detail=True, methods=['post'], url_path='deactivate')
    def deactivate(self, request, pk=None):
        """
        Deactivates a user (sets is_active=False).
        """
        try:
            user = self.get_object()
            user.is_active = False
            user.save(update_fields=['is_active'])
            return Response({'detail': 'User deactivated successfully'})

        except Exception as e:
            return Response(
                {'detail': f'Error deactivating user: {str(e)}'},
                status=status.HTTP_400_BAD_REQUEST
            )

    @action(detail=True, methods=['post'], url_path='reset-password')
    def reset_password(self, request, pk=None):
        """
        Resets a user's password (admin use).
        """
        try:
            user = self.get_object()
            new_password = request.data.get('password')

            if not new_password:
                return Response(
                    {'detail': 'Password is required'},
                    status=status.HTTP_400_BAD_REQUEST
                )

            user.set_password(new_password)
            # Saving only the password field is fine after set_password
            user.save(update_fields=['password'])

            return Response({'detail': 'Password reset successfully'})

        except Exception as e:
            return Response(
                {'detail': f'Error resetting password: {str(e)}'},
                status=status.HTTP_400_BAD_REQUEST
            )

    # ---------- Soft delete & Restore ----------

    @action(detail=True, methods=['post'], url_path='soft-delete')
    def soft_delete(self, request, pk=None):
        """
        Soft-deletes a user (sets is_deleted=True).
        """
        try:
            user = self.get_object()
            if getattr(user, 'is_deleted', False):
                return Response({'detail': 'User is already soft-deleted'}, status=status.HTTP_400_BAD_REQUEST)
            user.is_deleted = True
            user.save(update_fields=['is_deleted'])
            return Response({'detail': 'User soft-deleted successfully'})
        except Exception as e:
            return Response(
                {'detail': f'Error soft-deleting user: {str(e)}'},
                status=status.HTTP_400_BAD_REQUEST
            )

    @action(detail=True, methods=['post'], url_path='restore')
    def restore(self, request, pk=None):
        """
        Restores a soft-deleted user (sets is_deleted=False).
        """
        try:
            # need to fetch from all_objects to find deleted rows
            user = User.all_objects.get(pk=pk)
            if not getattr(user, 'is_deleted', False):
                return Response({'detail': 'User is not soft-deleted'}, status=status.HTTP_400_BAD_REQUEST)
            user.is_deleted = False
            user.save(update_fields=['is_deleted'])
            return Response({'detail': 'User restored successfully'})
        except User.DoesNotExist:
            return Response({'detail': 'User not found'}, status=status.HTTP_404_NOT_FOUND)
        except Exception as e:
            return Response(
                {'detail': f'Error restoring user: {str(e)}'},
                status=status.HTTP_400_BAD_REQUEST
            )
