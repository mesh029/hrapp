import { prisma } from '../app/lib/db';

async function checkNextStep() {
  try {
    const timesheetId = '331b5794-82d1-4951-8984-bb8c3dc7ef01';
    
    const timesheet = await prisma.timesheet.findUnique({
      where: { id: timesheetId },
      select: { 
        id: true,
        status: true,
        workflow_instance_id: true,
      },
    });

    if (!timesheet || !timesheet.workflow_instance_id) {
      console.log('No workflow instance found for this timesheet');
      return;
    }

    const workflowInstance = await prisma.workflowInstance.findUnique({
      where: { id: timesheet.workflow_instance_id },
      include: {
        template: {
          include: {
            steps: {
              orderBy: { step_order: 'asc' },
            },
          },
        },
        steps: {
          orderBy: { step_order: 'asc' },
          include: {
            actor: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
          },
        },
      },
    });

    if (!workflowInstance) {
      console.log('Workflow instance not found');
      return;
    }

    console.log('\n=== Workflow Status ===');
    console.log(`Status: ${workflowInstance.status}`);
    console.log(`Current Step Order: ${workflowInstance.current_step_order}`);
    console.log(`Total Steps: ${workflowInstance.template.steps.length}`);

    console.log('\n=== All Steps ===');
    workflowInstance.template.steps.forEach((step, idx) => {
      const stepInstance = workflowInstance.steps.find(s => s.step_order === step.step_order);
      const isCurrent = step.step_order === workflowInstance.current_step_order;
      console.log(`\nStep ${step.step_order} (${step.required_permission}):`);
      console.log(`  Status: ${stepInstance?.status || 'pending'}`);
      console.log(`  Actor: ${stepInstance?.actor?.name || 'N/A'} (${stepInstance?.actor?.email || 'N/A'})`);
      console.log(`  Acted At: ${stepInstance?.acted_at || 'N/A'}`);
      console.log(`  Current: ${isCurrent ? 'YES' : 'NO'}`);
    });

    const currentStep = workflowInstance.template.steps.find(
      s => s.step_order === workflowInstance.current_step_order
    );

    if (currentStep) {
      console.log('\n=== Current Step Details ===');
      console.log(`Step Order: ${currentStep.step_order}`);
      console.log(`Required Permission: ${currentStep.required_permission}`);
      
      const currentStepInstance = workflowInstance.steps.find(
        s => s.step_order === workflowInstance.current_step_order
      );
      
      if (currentStepInstance) {
        console.log(`Status: ${currentStepInstance.status}`);
        console.log(`Actor: ${currentStepInstance.actor?.name || 'N/A'}`);
      } else {
        console.log('Step instance not yet created');
      }
    }

    // Find next step
    const nextStep = workflowInstance.template.steps.find(
      s => s.step_order > workflowInstance.current_step_order
    );

    if (nextStep) {
      console.log('\n=== Next Step ===');
      console.log(`Step Order: ${nextStep.step_order}`);
      console.log(`Required Permission: ${nextStep.required_permission}`);
      
      // Find users who can approve this step
      const usersWithPermission = await prisma.user.findMany({
        where: {
          userRoles: {
            some: {
              role: {
                rolePermissions: {
                  some: {
                    permission: {
                      name: nextStep.required_permission,
                    },
                  },
                },
              },
            },
          },
        },
        select: {
          id: true,
          name: true,
          email: true,
          primary_location_id: true,
        },
      });

      console.log(`\nUsers who can approve next step (${nextStep.required_permission}):`);
      usersWithPermission.forEach(user => {
        console.log(`  - ${user.name} (${user.email})`);
      });
    } else {
      console.log('\n=== No Next Step ===');
      console.log('This is the final step or workflow is complete');
    }

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkNextStep();
